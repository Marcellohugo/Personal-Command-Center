using System.Net;
using System.Net.Http;
using System.IO;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PersonalCommandCenter.Desktop;

public sealed class SyncConfig
{
    public string ServerUrl { get; set; } = "";
    public string Password { get; set; } = "";
    public int Revision { get; set; }
    public bool Dirty { get; set; }
    public bool Enabled => ServerUrl.Length > 0;

    public static bool TryNormalizeUrl(string value, out string normalized)
    {
        normalized = "";
        if (!Uri.TryCreate(value.Trim().TrimEnd('/'), UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback)) return false;
        normalized = uri.GetLeftPart(UriPartial.Authority);
        return true;
    }
}

public sealed class SyncConfigStore(string? filePath = null)
{
    private string FilePath { get; } = filePath ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PersonalCommandCenter", "sync.json");

    public SyncConfig Load()
    {
        try
        {
            if (!File.Exists(FilePath)) return new();
            var saved = JsonSerializer.Deserialize<SavedSyncConfig>(File.ReadAllText(FilePath));
            if (saved is null) return new();
            return new SyncConfig
            {
                ServerUrl = saved.ServerUrl ?? "",
                Password = Unprotect(saved.ProtectedPassword),
                Revision = Math.Max(0, saved.Revision),
                Dirty = saved.Dirty
            };
        }
        catch (Exception error) when (error is IOException or JsonException or CryptographicException or FormatException)
        {
            return new();
        }
    }

    public void Save(SyncConfig config)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
        var saved = new SavedSyncConfig(config.ServerUrl, Protect(config.Password), config.Revision, config.Dirty);
        var temporary = FilePath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(saved));
        File.Move(temporary, FilePath, true);
    }

    private static string Protect(string value) => value.Length == 0 ? "" : Convert.ToBase64String(
        ProtectedData.Protect(Encoding.UTF8.GetBytes(value), null, DataProtectionScope.CurrentUser));

    private static string Unprotect(string? value) => string.IsNullOrEmpty(value) ? "" : Encoding.UTF8.GetString(
        ProtectedData.Unprotect(Convert.FromBase64String(value), null, DataProtectionScope.CurrentUser));

    private sealed record SavedSyncConfig(string ServerUrl, string ProtectedPassword, int Revision, bool Dirty);
}

public sealed class AppLockStore(string? filePath = null)
{
    private string FilePath { get; } = filePath ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PersonalCommandCenter", "lock.json");

    public bool IsConfigured => ReadPin().Length > 0;

    public bool Verify(string candidate)
    {
        var expected = Encoding.UTF8.GetBytes(ReadPin());
        var supplied = Encoding.UTF8.GetBytes(candidate);
        return expected.Length > 0 && expected.Length == supplied.Length && CryptographicOperations.FixedTimeEquals(expected, supplied);
    }

    public void Save(string pin)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
        var protectedPin = Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(pin), null, DataProtectionScope.CurrentUser));
        var temporary = FilePath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(new SavedAppLock(protectedPin)));
        File.Move(temporary, FilePath, true);
    }

    private string ReadPin()
    {
        try
        {
            if (!File.Exists(FilePath)) return "";
            var saved = JsonSerializer.Deserialize<SavedAppLock>(File.ReadAllText(FilePath));
            return saved is null ? "" : Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(saved.ProtectedPin), null, DataProtectionScope.CurrentUser));
        }
        catch (Exception error) when (error is IOException or JsonException or CryptographicException or FormatException)
        {
            return "";
        }
    }

    private sealed record SavedAppLock(string ProtectedPin);
}

public sealed record SyncResponse(HttpStatusCode StatusCode, Workspace? Data, int Revision, bool Exists, string? Error)
{
    public bool IsSuccess => (int)StatusCode is >= 200 and < 300;
    public bool IsConflict => StatusCode == HttpStatusCode.Conflict;
}

public sealed class WorkspaceSyncClient
{
    private static readonly HttpClient Client = new() { Timeout = TimeSpan.FromSeconds(12) };

    public Task<SyncResponse> GetAsync(SyncConfig config, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Get, config, null, cancellationToken);

    public Task<SyncResponse> PutAsync(SyncConfig config, Workspace workspace, bool force = false, CancellationToken cancellationToken = default)
    {
        using var document = JsonDocument.Parse(WorkspaceStore.Serialize(workspace));
        var payload = JsonSerializer.Serialize(new { data = document.RootElement, baseRevision = config.Revision, force });
        return SendAsync(HttpMethod.Put, config, payload, cancellationToken);
    }

    private static async Task<SyncResponse> SendAsync(HttpMethod method, SyncConfig config, string? payload, CancellationToken cancellationToken)
    {
        var uri = new Uri(new Uri(config.ServerUrl.TrimEnd('/') + "/"), "api/native-workspace");
        using var request = new HttpRequestMessage(method, uri);
        if (config.Password.Length > 0) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.Password);
        if (payload is not null) request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        using var response = await Client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var data = root.TryGetProperty("data", out var dataElement) ? WorkspaceStore.Deserialize(dataElement.GetRawText()) : null;
            var revision = root.TryGetProperty("revision", out var revisionElement) ? revisionElement.GetInt32() : config.Revision;
            var exists = root.TryGetProperty("exists", out var existsElement) && existsElement.GetBoolean();
            var error = root.TryGetProperty("error", out var errorElement) ? errorElement.GetString() : null;
            return new SyncResponse(response.StatusCode, data, revision, exists, error);
        }
        catch (Exception error) when (error is JsonException or InvalidDataException)
        {
            return new SyncResponse(response.StatusCode, null, config.Revision, false, error.Message);
        }
    }
}
