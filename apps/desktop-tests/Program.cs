using PersonalCommandCenter.Desktop;

var directory = Path.Combine(Path.GetTempPath(), "personal-command-center-test", Guid.NewGuid().ToString("N"));
var path = Path.Combine(directory, "workspace.json");

try
{
    var store = new WorkspaceStore(path);
    var original = Workspace.CreateDemo();
    original.LifeOs.Priorities.Add(new DailyPriority { Id = "priority-1", Date = "2026-08-27", Text = "Uji kontrak v5", Done = true });
    original.LifeOs.Gamification.TotalXp = 250;
    store.Save(original);
    var restored = store.Load();

    if (restored.Transactions.Count != 3 || restored.Agenda.Count != 2 || restored.Habits.Count != 3
        || restored.GrowthGoals.Count != 1 || restored.FocusSessions.Count != 1 || restored.DailyReviews.Count != 1
        || restored.Projects.Count != 1 || restored.Tickets.Count != 3)
        throw new InvalidOperationException("Workspace lokal kehilangan data saat round-trip JSON.");
    if (restored.Version != Workspace.CurrentVersion || restored.GrowthGoals.Single().Progress != 35)
        throw new InvalidOperationException("Data perkembangan tidak bertahan dalam cadangan Windows.");
    if (restored.LifeOs.Priorities.Single().Text != "Uji kontrak v5" || restored.LifeOs.Gamification.TotalXp != 250)
        throw new InvalidOperationException("Data Marco Life OS v5 tidak bertahan dalam cadangan Windows.");
    if (restored.Tickets.Count(item => item.Status == "in_progress") != 1 || restored.Tickets[0].Labels.Count == 0)
        throw new InvalidOperationException("Data Kanban tidak bertahan dalam cadangan Windows.");
    if (File.ReadAllText(path).Contains("Honor proyek", StringComparison.Ordinal))
        throw new InvalidOperationException("Cache Windows masih tersimpan sebagai teks biasa.");
    var yesterday = DateOnly.FromDateTime(DateTime.Today.AddDays(-1)).ToString("O");
    var datedHabit = new HabitItem(Guid.NewGuid().ToString(), "Tes tanggal", [yesterday]);
    if (datedHabit.IsDoneToday)
        throw new InvalidOperationException("Kebiasaan kemarin tidak boleh dianggap selesai hari ini.");
    var toggled = datedHabit.ToggleToday();
    if (!toggled.IsDoneToday || !WorkspaceStore.Deserialize(WorkspaceStore.Serialize(new Workspace { Habits = [toggled] })).Habits.Single().IsDoneToday)
        throw new InvalidOperationException("Riwayat kebiasaan tidak bertahan dalam backup.");
    var syncPath = Path.Combine(directory, "sync.json");
    var syncStore = new SyncConfigStore(syncPath);
    syncStore.Save(new SyncConfig { ServerUrl = "https://command.example.com", Password = "rahasia", Revision = 4, Dirty = true });
    var sync = syncStore.Load();
    if (sync.Password != "rahasia" || sync.Revision != 4 || !sync.Dirty || File.ReadAllText(syncPath).Contains("rahasia", StringComparison.Ordinal))
        throw new InvalidOperationException("Kredensial sinkronisasi tidak disimpan dengan aman.");
    if (!SyncConfig.TryNormalizeUrl("http://localhost:3001", out _) || SyncConfig.TryNormalizeUrl("http://command.example.com", out _))
        throw new InvalidOperationException("Validasi URL sinkronisasi tidak aman.");
    var lockPath = Path.Combine(directory, "lock.json");
    var appLock = new AppLockStore(lockPath);
    appLock.Save("482931");
    if (!appLock.IsConfigured || !appLock.Verify("482931") || appLock.Verify("000000") || File.ReadAllText(lockPath).Contains("482931", StringComparison.Ordinal))
        throw new InvalidOperationException("PIN aplikasi Windows tidak terlindungi dengan DPAPI.");
    var syncTestUrl = Environment.GetEnvironmentVariable("PCC_SYNC_TEST_URL");
    if (!string.IsNullOrWhiteSpace(syncTestUrl))
    {
        var client = new WorkspaceSyncClient();
        var config = new SyncConfig
        {
            ServerUrl = syncTestUrl,
            Password = Environment.GetEnvironmentVariable("PCC_SYNC_TEST_PASSWORD") ?? ""
        };
        var remote = await client.GetAsync(config);
        if (!remote.IsSuccess || remote.Data?.Transactions.Single().Title != "Data tersinkron"
            || remote.Data.GrowthGoals.Count != 2 || remote.Data.FocusSessions.Count != 1 || remote.Data.DailyReviews.Count != 1
            || remote.Data.Projects.Count != 1 || remote.Data.Tickets.Count < 1)
            throw new InvalidOperationException("Windows tidak dapat membaca workspace pusat.");
        config.Revision = remote.Revision;
        var uploaded = await client.PutAsync(config, remote.Data);
        if (!uploaded.IsSuccess || uploaded.Revision != remote.Revision + 1)
            throw new InvalidOperationException("Windows tidak dapat menulis workspace pusat.");
    }
    if (!File.Exists(path + ".tmp") && restored.Notes.Single().Title == "Fokus minggu ini")
        Console.WriteLine("Desktop local workspace test passed.");
    else
        throw new InvalidOperationException("Penyimpanan atomik tidak selesai dengan benar.");
}
finally
{
    if (Directory.Exists(directory)) Directory.Delete(directory, true);
}
