using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PersonalCommandCenter.Desktop;

public sealed class WorkspaceStore(string? filePath = null)
{
    private const string EncryptedPrefix = "pcc-dpapi-v1:";
    public string FilePath { get; } = filePath ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PersonalCommandCenter", "workspace.json");
    private static readonly JsonSerializerOptions Options = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };

    public Workspace Load()
    {
        if (!File.Exists(FilePath)) return Workspace.CreateDemo();
        try
        {
            var stored = File.ReadAllText(FilePath);
            var serialized = stored.StartsWith(EncryptedPrefix, StringComparison.Ordinal)
                ? Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(stored[EncryptedPrefix.Length..]), null, DataProtectionScope.CurrentUser))
                : stored;
            var workspace = Deserialize(serialized);
            if (!stored.StartsWith(EncryptedPrefix, StringComparison.Ordinal)) Save(workspace);
            return workspace;
        }
        catch (Exception error) when (error is JsonException or IOException or InvalidDataException or CryptographicException or FormatException)
        {
            var backup = $"{FilePath}.corrupt-{DateTime.Now:yyyyMMdd-HHmmss}.json";
            try { File.Copy(FilePath, backup, false); } catch (IOException) { }
            return Workspace.CreateDemo();
        }
    }

    public void Save(Workspace workspace)
    {
        var directory = Path.GetDirectoryName(FilePath)!;
        Directory.CreateDirectory(directory);
        var temporary = FilePath + ".tmp";
        var encrypted = ProtectedData.Protect(Encoding.UTF8.GetBytes(Serialize(workspace)), null, DataProtectionScope.CurrentUser);
        File.WriteAllText(temporary, EncryptedPrefix + Convert.ToBase64String(encrypted));
        File.Move(temporary, FilePath, true);
    }

    public static string Serialize(Workspace workspace) => JsonSerializer.Serialize(workspace.Normalize(), Options);

    public static Workspace Deserialize(string value)
    {
        var workspace = JsonSerializer.Deserialize<Workspace>(value, Options)
            ?? throw new InvalidDataException("Cadangan workspace kosong.");
        if (workspace.Version is < 1 or > Workspace.CurrentVersion) throw new InvalidDataException("Versi cadangan tidak didukung.");
        workspace.Validate();
        return workspace.Normalize();
    }
}

public sealed class Workspace
{
    public const int CurrentVersion = 5;
    public int Version { get; set; } = CurrentVersion;
    public List<TransactionItem> Transactions { get; set; } = [];
    public List<AgendaItem> Agenda { get; set; } = [];
    public List<NoteItem> Notes { get; set; } = [];
    public List<HabitItem> Habits { get; set; } = [];
    public List<GrowthGoal> GrowthGoals { get; set; } = [];
    public List<FocusSession> FocusSessions { get; set; } = [];
    public List<DailyReview> DailyReviews { get; set; } = [];
    public List<ProjectBoard> Projects { get; set; } = [];
    public List<KanbanTicket> Tickets { get; set; } = [];
    public LifeOsState LifeOs { get; set; } = new();
    public WorkspaceSettings Settings { get; set; } = new();

    public Workspace Normalize()
    {
        Transactions ??= [];
        Agenda ??= [];
        Notes ??= [];
        Habits ??= [];
        GrowthGoals ??= [];
        FocusSessions ??= [];
        DailyReviews ??= [];
        Projects ??= [];
        Tickets ??= [];
        LifeOs ??= new();
        Settings ??= new();
        Habits = Habits.Select(item => item.Normalize()).ToList();
        GrowthGoals = GrowthGoals.Select(item => item.Normalize()).ToList();
        FocusSessions = FocusSessions.Select(item => item.Normalize()).ToList();
        DailyReviews = DailyReviews.Select(item => item.Normalize()).ToList();
        Projects = Projects.Select(item => item.Normalize()).ToList();
        Tickets = Tickets.Select(item => item.Normalize()).ToList();
        LifeOs = LifeOs.Normalize();
        Version = CurrentVersion;
        return this;
    }

    public void Validate()
    {
        if (Transactions is null || Agenda is null || Notes is null || Habits is null || GrowthGoals is null || FocusSessions is null || DailyReviews is null || Projects is null || Tickets is null)
            throw new InvalidDataException("Daftar data wajib tidak tersedia.");
        if (Transactions.Any(item => item is null || string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Title) || item.Amount <= 0 || item.Date == default)
            || Agenda.Any(item => item is null || string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Title) || item.Date == default)
            || Notes.Any(item => item is null || string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Title))
            || Habits.Any(item => item is null || string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Name))
            || GrowthGoals.Any(item => item is null || string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Title))
            || FocusSessions.Any(item => item is null || string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Title) || item.Minutes <= 0 || item.Date == default)
            || DailyReviews.Any(item => item is null || string.IsNullOrWhiteSpace(item.Id) || item.Date == default)
            || Projects.Any(item => item is null || string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Name))
            || Tickets.Any(item => item is null || string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.ProjectId) || string.IsNullOrWhiteSpace(item.Title)))
            throw new InvalidDataException("Cadangan berisi data yang tidak valid.");
    }

    public static Workspace CreateDemo()
    {
        var today = DateTime.Today;
        return new Workspace
        {
            Transactions =
            [
                new(Guid.NewGuid().ToString(), "Honor proyek", 4_500_000, true, today.AddDays(-2)),
                new(Guid.NewGuid().ToString(), "Belanja mingguan", 425_000, false, today.AddDays(-1)),
                new(Guid.NewGuid().ToString(), "Kopi dan sarapan", 48_000, false, today)
            ],
            Agenda =
            [
                new(Guid.NewGuid().ToString(), "Review prioritas mingguan", today, false),
                new(Guid.NewGuid().ToString(), "Olahraga ringan", today.AddDays(1), false)
            ],
            Notes =
            [
                new(Guid.NewGuid().ToString(), "Fokus minggu ini", "Selesaikan satu pekerjaan penting sebelum membuka pesan.", DateTime.Now)
            ],
            Habits =
            [
                HabitItem.Create(Guid.NewGuid().ToString(), "Minum air putih", true),
                HabitItem.Create(Guid.NewGuid().ToString(), "Membaca 20 menit"),
                HabitItem.Create(Guid.NewGuid().ToString(), "Jalan kaki")
            ],
            GrowthGoals =
            [
                new(Guid.NewGuid().ToString(), "Tingkatkan kemampuan utama", "learning", 35, DateOnly.FromDateTime(today.AddDays(45)).ToString("O"), "Latihan fokus 30 menit", DateTime.Now)
            ],
            FocusSessions =
            [
                new(Guid.NewGuid().ToString(), "Belajar terarah", "learning", 30, today, "Satu konsep baru dipahami.")
            ],
            DailyReviews =
            [
                new(Guid.NewGuid().ToString(), today, 4, 4, "Menentukan prioritas utama", "Kemajuan kecil tetap berarti", "Kerjakan langkah berikutnya sebelum membuka pesan")
            ],
            Projects =
            [
                new("project-demo", "Pengembangan diri", "Board untuk mengubah tujuan menjadi pekerjaan nyata.", "#2563EB", false, DateTime.Now)
            ],
            Tickets =
            [
                KanbanTicket.Create("project-demo", "Susun target 30 hari", "Pecah target utama menjadi langkah mingguan.", "in_progress", "high", ["rencana"]),
                KanbanTicket.Create("project-demo", "Jalankan sesi fokus pertama", "Catat hasil dan pelajaran setelah selesai.", "ready", "medium", ["fokus"]),
                KanbanTicket.Create("project-demo", "Review progres mingguan", "Lihat yang selesai dan pilih prioritas berikutnya.", "backlog", "low", ["review"])
            ],
            Settings = new WorkspaceSettings { MonthlyBudget = 5_000_000 }
        };
    }
}

public sealed record TransactionItem(string Id, string Title, decimal Amount, bool IsIncome, DateTime Date)
{
    [JsonIgnore] public bool HideAmount { get; set; }
    [JsonIgnore] public string DisplayAmount => HideAmount ? "••••••" : $"{(IsIncome ? "+" : "−")}Rp {Amount.ToString("N0", CultureInfo.GetCultureInfo("id-ID"))}";
    [JsonIgnore] public string AmountColor => IsIncome ? "#2563EB" : "#D65368";
    [JsonIgnore] public string DateLabel => Date.ToString("d MMMM yyyy", CultureInfo.GetCultureInfo("id-ID"));
}

public sealed class WorkspaceSettings
{
    public decimal MonthlyBudget { get; set; }
    public bool HideBalances { get; set; }
}

public sealed class LifeOsState
{
    public LifeCycle Cycle { get; set; } = new();
    public List<DailyCheckIn> CheckIns { get; set; } = [];
    public List<DailyPriority> Priorities { get; set; } = [];
    public List<WeeklyReview> WeeklyReviews { get; set; } = [];
    public List<WeeklyQuest> WeeklyQuests { get; set; } = [];
    public GamificationState Gamification { get; set; } = new();

    public LifeOsState Normalize()
    {
        Cycle ??= new();
        CheckIns ??= [];
        Priorities ??= [];
        WeeklyReviews ??= [];
        WeeklyQuests ??= [];
        Gamification ??= new();
        Priorities = Priorities.Where(item => !string.IsNullOrWhiteSpace(item.Id) && !string.IsNullOrWhiteSpace(item.Text)).Take(10_000).ToList();
        WeeklyQuests = WeeklyQuests.Where(item => !string.IsNullOrWhiteSpace(item.Id) && !string.IsNullOrWhiteSpace(item.Title)).Take(10_000).ToList();
        Gamification.Normalize();
        return this;
    }
}

public sealed class LifeCycle
{
    public string Id { get; set; } = "cycle-1";
    public string Name { get; set; } = "Siklus 1";
    public string StartDate { get; set; } = "";
    public string EndDate { get; set; } = "";
    public string Status { get; set; } = "setup";
    public string? ClosedAt { get; set; }
    public List<string> CopiedGoalIds { get; set; } = [];
}

public sealed class DailyCheckIn
{
    public string Id { get; set; } = "";
    public string Date { get; set; } = "";
    public string? MorningCompletedAt { get; set; }
    public string? EveningCompletedAt { get; set; }
    public int? Energy { get; set; }
    public string Reflection { get; set; } = "";
    public string Win { get; set; } = "";
    public string Lesson { get; set; } = "";
    public string NextStep { get; set; } = "";
}

public sealed class DailyPriority
{
    public string Id { get; set; } = "";
    public string Date { get; set; } = "";
    public string Text { get; set; } = "";
    public bool Done { get; set; }
    public LifeOsLink? Link { get; set; }
}

public sealed class WeeklyReview
{
    public string Id { get; set; } = "";
    public string WeekStart { get; set; } = "";
    public string CompletedAt { get; set; } = "";
    public string Summary { get; set; } = "";
    public string WhatWorked { get; set; } = "";
    public string NextFocus { get; set; } = "";
}

public sealed class WeeklyQuest
{
    public string Id { get; set; } = "";
    public string WeekStart { get; set; } = "";
    public string Title { get; set; } = "";
    public bool Done { get; set; }
    public LifeOsLink? Link { get; set; }
    public string CreatedAt { get; set; } = "";
}

public sealed class LifeOsLink
{
    public string Type { get; set; } = "goal";
    public string Id { get; set; } = "";
}

public sealed class GamificationState
{
    public int TotalXp { get; set; }
    public List<AchievementState> Achievements { get; set; } = [];
    public List<string> RitualDays { get; set; } = [];
    public List<string> PerfectDays { get; set; } = [];
    public List<string> LastAwardKeys { get; set; } = [];

    public void Normalize()
    {
        TotalXp = Math.Max(0, TotalXp);
        Achievements ??= [];
        RitualDays = (RitualDays ?? []).Distinct().Order().TakeLast(5_000).ToList();
        PerfectDays = (PerfectDays ?? []).Distinct().Order().TakeLast(5_000).ToList();
        LastAwardKeys = (LastAwardKeys ?? []).Distinct().TakeLast(5_000).ToList();
    }
}

public sealed class AchievementState
{
    public string Id { get; set; } = "";
    public string UnlockedAt { get; set; } = "";
}

public sealed record AgendaItem(string Id, string Title, DateTime Date, bool IsDone)
{
    [JsonIgnore] public string DateLabel => Date.ToString("dddd, d MMMM yyyy", CultureInfo.GetCultureInfo("id-ID"));
    [JsonIgnore] public string StatusLabel => IsDone ? "Selesai" : "Belum selesai";
    [JsonIgnore] public string ToggleLabel => IsDone ? "Batalkan" : "Selesai";
}

public sealed record NoteItem(string Id, string Title, string Body, DateTime UpdatedAt)
{
    [JsonIgnore] public string UpdatedLabel => $"Diperbarui {UpdatedAt.ToString("d MMM, HH:mm", CultureInfo.GetCultureInfo("id-ID"))}";
}

public sealed record HabitItem(string Id, string Name, List<string>? CompletedDates)
{
    private static string TodayKey => DateOnly.FromDateTime(DateTime.Today).ToString("O", CultureInfo.InvariantCulture);

    [JsonPropertyName("isDoneToday")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool LegacyIsDoneToday { get; init; }

    [JsonIgnore] public bool IsDoneToday => CompletedDates?.Contains(TodayKey) == true || LegacyIsDoneToday;
    [JsonIgnore] public int CurrentStreak
    {
        get
        {
            var completed = new HashSet<string>(CompletedDates ?? []);
            var cursor = DateOnly.FromDateTime(DateTime.Today);
            var streak = 0;
            while (completed.Contains(cursor.ToString("O", CultureInfo.InvariantCulture)))
            {
                streak++;
                cursor = cursor.AddDays(-1);
            }
            return streak;
        }
    }

    public static HabitItem Create(string id, string name, bool completedToday = false) =>
        new(id, name, completedToday ? [TodayKey] : []);

    public HabitItem Normalize()
    {
        var dates = (CompletedDates ?? [])
            .Where(value => DateOnly.TryParseExact(value, "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            .Distinct()
            .OrderBy(value => value)
            .ToList();
        if (LegacyIsDoneToday && !dates.Contains(TodayKey)) dates.Add(TodayKey);
        return this with { CompletedDates = dates, LegacyIsDoneToday = false };
    }

    public HabitItem ToggleToday()
    {
        var dates = new List<string>(CompletedDates ?? []);
        if (!dates.Remove(TodayKey)) dates.Add(TodayKey);
        return this with { CompletedDates = dates, LegacyIsDoneToday = false };
    }

    [JsonIgnore] public string StatusLabel => IsDoneToday ? "Selesai hari ini" : "Belum dilakukan";
    [JsonIgnore] public string ToggleLabel => IsDoneToday ? "Batalkan" : "Tandai selesai";
    [JsonIgnore] public string StreakLabel => CurrentStreak > 0 ? $"Beruntun {CurrentStreak} hari" : StatusLabel;
    [JsonIgnore] public string StatusIcon => IsDoneToday ? "✓" : "○";
    [JsonIgnore] public string StatusColor => IsDoneToday ? "#2563EB" : "#66768D";
    [JsonIgnore] public string StatusBackground => IsDoneToday ? "#E9F2FF" : "#F0F4F9";
}

public static class GrowthAreas
{
    public static readonly string[] Values = ["career", "learning", "health", "finance", "personal"];
    public static string Normalize(string? value) => Values.Contains(value) ? value! : "personal";
    public static string Label(string value) => value switch
    {
        "career" => "Karier",
        "learning" => "Belajar",
        "health" => "Kesehatan",
        "finance" => "Keuangan",
        _ => "Pribadi"
    };
}

public sealed record GrowthGoal(string Id, string Title, string Area, int Progress, string TargetDate, string NextAction, DateTime CreatedAt)
{
    [JsonIgnore] public string AreaLabel => GrowthAreas.Label(Area);
    [JsonIgnore] public string ProgressLabel => $"{Progress}%";
    [JsonIgnore] public string TargetLabel => DateOnly.TryParseExact(TargetDate, "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? $"Target {date.ToString("d MMM yyyy", CultureInfo.GetCultureInfo("id-ID"))}" : "Tanpa tenggat";
    [JsonIgnore] public string StatusLabel => Progress >= 100 ? "Selesai" : string.IsNullOrWhiteSpace(NextAction) ? "Tentukan langkah berikutnya" : NextAction;
    public GrowthGoal Normalize() => this with
    {
        Area = GrowthAreas.Normalize(Area),
        Progress = Math.Clamp(Progress, 0, 100),
        TargetDate = DateOnly.TryParseExact(TargetDate, "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) ? TargetDate : "",
        NextAction = NextAction?.Trim() ?? ""
    };
}

public sealed record FocusSession(string Id, string Title, string Area, int Minutes, DateTime Date, string Note)
{
    [JsonIgnore] public string SummaryLabel => $"{GrowthAreas.Label(Area)} · {Minutes} menit · {Date.ToString("d MMM yyyy", CultureInfo.GetCultureInfo("id-ID"))}";
    public FocusSession Normalize() => this with { Area = GrowthAreas.Normalize(Area), Minutes = Math.Clamp(Minutes, 1, 1440), Note = Note?.Trim() ?? "" };
}

public sealed record DailyReview(string Id, DateTime Date, int Mood, int Energy, string Win, string Lesson, string NextStep)
{
    [JsonIgnore] public string DateLabel => Date.ToString("dddd, d MMMM yyyy", CultureInfo.GetCultureInfo("id-ID"));
    [JsonIgnore] public string ScoreLabel => $"Mood {Mood}/5 · Energi {Energy}/5";
    public DailyReview Normalize() => this with
    {
        Mood = Math.Clamp(Mood, 1, 5),
        Energy = Math.Clamp(Energy, 1, 5),
        Win = Win?.Trim() ?? "",
        Lesson = Lesson?.Trim() ?? "",
        NextStep = NextStep?.Trim() ?? ""
    };
}

public static class KanbanValues
{
    public static readonly string[] Statuses = ["backlog", "ready", "in_progress", "review", "done"];
    public static readonly string[] Priorities = ["low", "medium", "high", "urgent"];
    public static string StatusLabel(string value) => value switch { "ready" => "Siap", "in_progress" => "Dikerjakan", "review" => "Review", "done" => "Selesai", _ => "Backlog" };
    public static string PriorityLabel(string value) => value switch { "low" => "Rendah", "high" => "Tinggi", "urgent" => "Mendesak", _ => "Sedang" };
}

public sealed record ProjectBoard(string Id, string Name, string Description, string Color, bool Archived, DateTime CreatedAt)
{
    public ProjectBoard Normalize() => this with
    {
        Name = (Name ?? "").Trim()[..Math.Min((Name ?? "").Trim().Length, 120)],
        Description = (Description ?? "").Trim()[..Math.Min((Description ?? "").Trim().Length, 1000)],
        Color = System.Text.RegularExpressions.Regex.IsMatch(Color ?? "", "^#[0-9A-Fa-f]{6}$") ? Color! : "#2563EB",
        CreatedAt = CreatedAt == default ? DateTime.Now : CreatedAt
    };
}

public sealed record TicketChecklistItem(string Id, string Text, bool Done);
public sealed record TicketComment(string Id, string Body, DateTime CreatedAt)
{
    [JsonIgnore] public string DateLabel => CreatedAt.ToString("d MMM, HH:mm", CultureInfo.GetCultureInfo("id-ID"));
}

public sealed record KanbanTicket(
    string Id, string ProjectId, string Title, string Description, string Status, string Priority, List<string> Labels,
    string DueDate, List<TicketChecklistItem> Checklist, List<TicketComment> Comments, string? LinkedScheduleId,
    string? LinkedGrowthGoalId, bool Archived, long Order, DateTime CreatedAt, DateTime UpdatedAt)
{
    public static KanbanTicket Create(string projectId, string title, string description, string status = "backlog", string priority = "medium", List<string>? labels = null) =>
        new(Guid.NewGuid().ToString(), projectId, title, description, status, priority, labels ?? [], "", [], [], null, null, false, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), DateTime.Now, DateTime.Now);

    [JsonIgnore] public string StatusLabel => KanbanValues.StatusLabel(Status);
    [JsonIgnore] public string PriorityLabel => KanbanValues.PriorityLabel(Priority);
    [JsonIgnore] public string LabelsLabel => string.Join(" · ", Labels ?? []);
    [JsonIgnore] public string DueLabel => DateOnly.TryParseExact(DueDate, "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? $"Tenggat {date.ToString("d MMM", CultureInfo.GetCultureInfo("id-ID"))}" : "Tanpa tenggat";
    [JsonIgnore] public string ChecklistLabel => $"{(Checklist ?? []).Count(item => item.Done)}/{(Checklist ?? []).Count} checklist";

    public KanbanTicket Normalize() => this with
    {
        Title = (Title ?? "").Trim()[..Math.Min((Title ?? "").Trim().Length, 160)],
        Description = (Description ?? "").Trim()[..Math.Min((Description ?? "").Trim().Length, 5000)],
        Status = KanbanValues.Statuses.Contains(Status) ? Status : "backlog",
        Priority = KanbanValues.Priorities.Contains(Priority) ? Priority : "medium",
        Labels = (Labels ?? []).Where(item => !string.IsNullOrWhiteSpace(item)).Select(item => item.Trim()[..Math.Min(item.Trim().Length, 30)]).Distinct().Take(10).ToList(),
        DueDate = DateOnly.TryParseExact(DueDate, "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) ? DueDate : "",
        Checklist = (Checklist ?? []).Where(item => item is not null && !string.IsNullOrWhiteSpace(item.Id) && !string.IsNullOrWhiteSpace(item.Text)).Take(100).ToList(),
        Comments = (Comments ?? []).Where(item => item is not null && !string.IsNullOrWhiteSpace(item.Id) && !string.IsNullOrWhiteSpace(item.Body)).Take(200).ToList(),
        Order = Math.Max(0, Order),
        CreatedAt = CreatedAt == default ? DateTime.Now : CreatedAt,
        UpdatedAt = UpdatedAt == default ? DateTime.Now : UpdatedAt
    };
}
