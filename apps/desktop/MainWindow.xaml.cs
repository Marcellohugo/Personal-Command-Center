using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Microsoft.Win32;

namespace PersonalCommandCenter.Desktop;

public partial class MainWindow : Window
{
    private static readonly string[] DailyMessages =
    [
        "Satu langkah kecil hari ini tetap mengubah arah hidupmu.",
        "Kemajuan tumbuh saat niat diberi waktu dan tindakan.",
        "Tidak perlu sempurna—cukup hadir dan bergerak lagi.",
        "Energi mengikuti kejelasan. Pilih satu hal, lalu mulai.",
        "Konsistensi yang tenang akan mengalahkan semangat sesaat.",
        "Rayakan yang sudah maju, lalu lanjutkan satu langkah lagi.",
        "Masa depan dibangun dari keputusan kecil yang kamu tepati."
    ];

    private readonly WorkspaceStore store = new();
    private readonly SyncConfigStore syncConfigStore = new();
    private readonly AppLockStore appLockStore = new();
    private readonly WorkspaceSyncClient syncClient = new();
    private Workspace workspace = Workspace.CreateDemo();
    private SyncConfig syncConfig = new();
    private bool syncing;
    private int localChangeVersion;
    private string? editingTransactionId;
    private string? editingAgendaId;
    private string? editingNoteId;
    private string? editingHabitId;
    private string? editingGrowthGoalId;
    private string? editingTicketId;
    private string selectedProjectId = "";
    private bool renderingProjects;
    private string currentPage = "overview";
    private bool settingPin;
    private int failedUnlocks;
    private DateTime blockedUntil;

    public MainWindow() => InitializeComponent();

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        ShowAppLock(!appLockStore.IsConfigured);
        workspace = store.Load();
        syncConfig = syncConfigStore.Load();
        SyncServerInput.Text = syncConfig.ServerUrl;
        AgendaDateInput.SelectedDate = DateTime.Today;
        TransactionDateInput.SelectedDate = DateTime.Today;
        FocusDateInput.SelectedDate = DateTime.Today;
        ReviewDateInput.SelectedDate = DateTime.Today;
        ShowPage("overview");
        Render();
        SetSyncStatus(syncConfig.Enabled ? "Menunggu sinkronisasi" : "Tersimpan lokal", syncConfig.Enabled ? "Menghubungkan ke server…" : "Isi alamat server agar semua perangkat memakai data yang sama.");
        await SyncAsync();
    }

    private void ShowAppLock(bool setup)
    {
        settingPin = setup;
        AppShell.IsEnabled = false;
        LockOverlay.Visibility = Visibility.Visible;
        LockConfirmPanel.Visibility = setup ? Visibility.Visible : Visibility.Collapsed;
        LockTitle.Text = setup ? appLockStore.IsConfigured ? "Ganti PIN" : "Buat PIN keamanan" : "Buka aplikasi";
        LockDescription.Text = setup
            ? "Buat PIN 6 digit yang mudah Anda ingat. Tidak diperlukan akun atau sign in."
            : "Masukkan PIN perangkat untuk membuka seluruh workspace.";
        UnlockButton.Content = setup ? "Simpan & buka" : "Buka dengan aman";
        LockPinInput.Clear();
        LockConfirmInput.Clear();
        LockStatus.Text = "";
        Dispatcher.BeginInvoke(() => LockPinInput.Focus());
    }

    private void UnlockClick(object sender, RoutedEventArgs e)
    {
        var pin = LockPinInput.Password;
        if (pin.Length != 6 || pin.Any(character => !char.IsDigit(character)))
        {
            LockStatus.Text = "PIN harus berisi tepat 6 angka.";
            return;
        }

        if (settingPin)
        {
            if (pin != LockConfirmInput.Password)
            {
                LockStatus.Text = "Konfirmasi PIN belum sama.";
                return;
            }
            appLockStore.Save(pin);
            failedUnlocks = 0;
            CompleteUnlock();
            return;
        }

        if (blockedUntil > DateTime.UtcNow)
        {
            LockStatus.Text = $"Terlalu banyak percobaan. Coba lagi dalam {Math.Ceiling((blockedUntil - DateTime.UtcNow).TotalSeconds)} detik.";
            return;
        }
        if (appLockStore.Verify(pin))
        {
            failedUnlocks = 0;
            CompleteUnlock();
            return;
        }

        failedUnlocks++;
        LockPinInput.Clear();
        if (failedUnlocks >= 5)
        {
            failedUnlocks = 0;
            blockedUntil = DateTime.UtcNow.AddSeconds(30);
            LockStatus.Text = "Terlalu banyak percobaan. Aplikasi dikunci selama 30 detik.";
        }
        else LockStatus.Text = $"PIN tidak cocok. Tersisa {5 - failedUnlocks} percobaan.";
    }

    private void CompleteUnlock()
    {
        LockOverlay.Visibility = Visibility.Collapsed;
        AppShell.IsEnabled = true;
        SearchInput.Focus();
    }

    private void LockPinKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter) return;
        UnlockClick(UnlockButton, new RoutedEventArgs());
        e.Handled = true;
    }

    private void LockNowClick(object sender, RoutedEventArgs e) => ShowAppLock(false);

    private void ChangePinClick(object sender, RoutedEventArgs e) => ShowAppLock(true);

    private void WindowStateChanged(object? sender, EventArgs e)
    {
        if (WindowState == WindowState.Minimized && appLockStore.IsConfigured) ShowAppLock(false);
    }

    private void NavigateClick(object sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: string page }) ShowPage(page);
    }

    private void ShowPage(string page)
    {
        currentPage = page;
        var pages = new Dictionary<string, (FrameworkElement Panel, string Title, string Subtitle)>
        {
            ["overview"] = (OverviewPage, "Ringkasan", "Semua yang penting untuk hari ini."),
            ["transactions"] = (TransactionsPage, "Transaksi", "Catat arus uang tanpa koneksi internet."),
            ["agenda"] = (AgendaPage, "Agenda", "Susun kegiatan dan tandai yang sudah selesai."),
            ["notes"] = (NotesPage, "Catatan", "Simpan ide dan hal penting di perangkat ini."),
            ["habits"] = (HabitsPage, "Kebiasaan", "Bangun ritme kecil yang konsisten."),
            ["projects"] = (ProjectsPage, "Proyek", "Kelola pekerjaan seperti board ticket GitHub."),
            ["growth"] = (GrowthPage, "Perkembangan", "Ukur tujuan, fokus, refleksi, dan momentum Anda."),
            ["settings"] = (SettingsPage, "Pengaturan", "Privasi, backup, dan sinkronisasi semua perangkat.")
        };
        foreach (var item in pages.Values) item.Panel.Visibility = Visibility.Collapsed;
        var selected = pages[page];
        selected.Panel.Visibility = Visibility.Visible;
        HeaderTitle.Text = selected.Title;
        HeaderSubtitle.Text = selected.Subtitle;
        SearchInput.ToolTip = $"Cari di {selected.Title.ToLowerInvariant()}";
        SearchInput.IsEnabled = page is not ("overview" or "settings");

        var nav = new Dictionary<string, Button>
        {
            ["overview"] = OverviewNav,
            ["transactions"] = TransactionsNav,
            ["agenda"] = AgendaNav,
            ["notes"] = NotesNav,
            ["habits"] = HabitsNav,
            ["projects"] = ProjectsNav,
            ["growth"] = GrowthNav,
            ["settings"] = SettingsNav
        };
        foreach (var item in nav)
        {
            item.Value.Background = item.Key == page
                ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(29, 78, 216))
                : System.Windows.Media.Brushes.Transparent;
        }
    }

    private void Render()
    {
        var culture = CultureInfo.GetCultureInfo("id-ID");
        var query = SearchInput.Text.Trim();
        static bool Contains(string value, string query) => value.Contains(query, StringComparison.CurrentCultureIgnoreCase);
        foreach (var item in workspace.Transactions) item.HideAmount = workspace.Settings.HideBalances;
        var monthExpenses = workspace.Transactions
            .Where(item => !item.IsIncome && item.Date.Year == DateTime.Today.Year && item.Date.Month == DateTime.Today.Month)
            .Sum(item => item.Amount);
        var balance = workspace.Transactions.Sum(item => item.IsIncome ? item.Amount : -item.Amount);
        var todayAgenda = workspace.Agenda.Where(item => item.Date.Date == DateTime.Today && !item.IsDone).OrderBy(item => item.Date).ToList();
        var doneHabits = workspace.Habits.Count(item => item.IsDoneToday);
        var activeGoal = workspace.GrowthGoals.Where(item => item.Progress < 100 && !string.IsNullOrWhiteSpace(item.NextAction)).OrderBy(item => item.TargetDate).FirstOrDefault();
        var pendingHabit = workspace.Habits.FirstOrDefault(item => !item.IsDoneToday);
        var greeting = DateTime.Now.Hour switch { < 11 => "Selamat pagi", < 15 => "Selamat siang", < 19 => "Selamat sore", _ => "Selamat malam" };

        GreetingText.Text = $"{greeting} · ayo menangkan hari ini";
        MotivationText.Text = DailyMessages[DateTime.Today.DayOfYear % DailyMessages.Length];
        MissionText.Text = activeGoal?.NextAction ?? todayAgenda.FirstOrDefault()?.Title ?? pendingHabit?.Name ?? "Tulis kemenangan hari ini dan siapkan langkah kecil berikutnya.";
        CurrentDate.Text = DateTime.Today.ToString("dddd, d MMMM yyyy", culture);
        BalanceText.Text = Currency(balance);
        ExpenseText.Text = Currency(monthExpenses);
        AgendaCountText.Text = $"{todayAgenda.Count} kegiatan";
        HabitCountText.Text = $"{doneHabits}/{workspace.Habits.Count}";
        var todayKey = DateTime.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var todayCheckIn = workspace.LifeOs.CheckIns.FirstOrDefault(item => item.Date.StartsWith(todayKey, StringComparison.Ordinal));
        var todayPriorities = workspace.LifeOs.Priorities.Where(item => item.Date.StartsWith(todayKey, StringComparison.Ordinal)).Take(3).ToList();
        var ritualDates = workspace.LifeOs.Gamification.RitualDays.ToHashSet(StringComparer.Ordinal);
        var streakCursor = DateTime.Today;
        var ritualStreak = 0;
        while (ritualDates.Contains(streakCursor.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))) { ritualStreak++; streakCursor = streakCursor.AddDays(-1); }
        var level = 1 + workspace.LifeOs.Gamification.TotalXp / 250;
        LifeCycleText.Text = workspace.LifeOs.Cycle.Status == "active" ? $"{workspace.LifeOs.Cycle.Name} · sampai {workspace.LifeOs.Cycle.EndDate}" : "Siklus 12 minggu belum dimulai";
        LifeXpText.Text = $"Level {level} · {workspace.LifeOs.Gamification.TotalXp} XP · streak {ritualStreak} hari";
        StartCycleButton.Visibility = workspace.LifeOs.Cycle.Status == "active" ? Visibility.Collapsed : Visibility.Visible;
        MorningRitualButton.Content = todayCheckIn?.MorningCompletedAt is not null ? "✓ Pagi selesai" : "Ritual pagi";
        EveningRitualButton.Content = todayCheckIn?.EveningCompletedAt is not null ? "✓ Malam selesai" : "Ritual malam";
        MorningRitualButton.IsEnabled = todayCheckIn?.MorningCompletedAt is null;
        EveningRitualButton.IsEnabled = todayCheckIn?.EveningCompletedAt is null;
        LifePriorityList.ItemsSource = todayPriorities;
        RecentTransactionList.ItemsSource = workspace.Transactions.OrderByDescending(item => item.Date).Take(5).ToList();
        TodayAgendaList.ItemsSource = todayAgenda;
        TransactionList.ItemsSource = workspace.Transactions.Where(item => query.Length == 0 || Contains(item.Title, query)).OrderByDescending(item => item.Date).ToList();
        AgendaList.ItemsSource = workspace.Agenda.Where(item => query.Length == 0 || Contains(item.Title, query)).OrderBy(item => item.Date).ToList();
        NoteList.ItemsSource = workspace.Notes.Where(item => query.Length == 0 || Contains($"{item.Title} {item.Body}", query)).OrderByDescending(item => item.UpdatedAt).ToList();
        HabitList.ItemsSource = workspace.Habits.Where(item => query.Length == 0 || Contains(item.Name, query)).ToList();
        GrowthGoalList.ItemsSource = workspace.GrowthGoals.Where(item => query.Length == 0 || Contains($"{item.Title} {item.NextAction}", query)).OrderBy(item => item.Progress >= 100).ThenBy(item => item.TargetDate).ToList();
        FocusSessionList.ItemsSource = workspace.FocusSessions.Where(item => query.Length == 0 || Contains($"{item.Title} {item.Note}", query)).OrderByDescending(item => item.Date).Take(8).ToList();
        DailyReviewList.ItemsSource = workspace.DailyReviews.Where(item => query.Length == 0 || Contains($"{item.Win} {item.Lesson} {item.NextStep}", query)).OrderByDescending(item => item.Date).Take(8).ToList();
        var activeProjects = workspace.Projects.Where(item => !item.Archived).OrderBy(item => item.CreatedAt).ToList();
        if (activeProjects.All(item => item.Id != selectedProjectId)) selectedProjectId = activeProjects.FirstOrDefault()?.Id ?? "";
        renderingProjects = true;
        ProjectBoardInput.ItemsSource = activeProjects;
        ProjectBoardInput.SelectedItem = activeProjects.FirstOrDefault(item => item.Id == selectedProjectId);
        TicketAgendaInput.ItemsSource = workspace.Agenda.OrderBy(item => item.Date).ToList();
        TicketGrowthInput.ItemsSource = workspace.GrowthGoals.OrderBy(item => item.TargetDate).ToList();
        renderingProjects = false;
        var visibleTickets = workspace.Tickets
            .Where(item => !item.Archived && item.ProjectId == selectedProjectId && (query.Length == 0 || Contains($"{item.Title} {item.Description} {string.Join(' ', item.Labels)}", query)))
            .OrderBy(item => item.Order).ThenBy(item => item.CreatedAt).ToList();
        BacklogTicketList.ItemsSource = visibleTickets.Where(item => item.Status == "backlog").ToList();
        ReadyTicketList.ItemsSource = visibleTickets.Where(item => item.Status == "ready").ToList();
        InProgressTicketList.ItemsSource = visibleTickets.Where(item => item.Status == "in_progress").ToList();
        ReviewTicketList.ItemsSource = visibleTickets.Where(item => item.Status == "review").ToList();
        DoneTicketList.ItemsSource = visibleTickets.Where(item => item.Status == "done").ToList();
        var editingTicket = editingTicketId is null ? null : workspace.Tickets.FirstOrDefault(item => item.Id == editingTicketId);
        TicketDetailPanel.Visibility = editingTicket is null ? Visibility.Collapsed : Visibility.Visible;
        TicketChecklistList.ItemsSource = editingTicket?.Checklist.ToList() ?? [];
        TicketCommentList.ItemsSource = editingTicket?.Comments.OrderByDescending(item => item.CreatedAt).ToList() ?? [];
        if (editingTicket is not null)
        {
            TicketAgendaInput.SelectedItem = workspace.Agenda.FirstOrDefault(item => item.Id == editingTicket.LinkedScheduleId);
            TicketGrowthInput.SelectedItem = workspace.GrowthGoals.FirstOrDefault(item => item.Id == editingTicket.LinkedGrowthGoalId);
        }
        var completedGoals = workspace.GrowthGoals.Count(item => item.Progress >= 100);
        var averageProgress = workspace.GrowthGoals.Count == 0 ? 0 : (int)Math.Round(workspace.GrowthGoals.Average(item => item.Progress));
        var weekStart = DateTime.Today.AddDays(-6);
        var weeklyMinutes = workspace.FocusSessions.Where(item => item.Date.Date >= weekStart && item.Date.Date <= DateTime.Today).Sum(item => item.Minutes);
        var reviewDates = workspace.DailyReviews.Select(item => DateOnly.FromDateTime(item.Date)).ToHashSet();
        var cursor = DateOnly.FromDateTime(DateTime.Today);
        if (!reviewDates.Contains(cursor)) cursor = cursor.AddDays(-1);
        var reviewStreak = 0;
        while (reviewDates.Contains(cursor)) { reviewStreak++; cursor = cursor.AddDays(-1); }
        var growthScore = Math.Min(100, (int)Math.Round(averageProgress * .5 + Math.Min(weeklyMinutes / 300d, 1) * 25 + Math.Min(reviewStreak / 7d, 1) * 15 + Math.Min(completedGoals, 1) * 10));
        OverviewGrowthScoreText.Text = growthScore.ToString(CultureInfo.InvariantCulture);
        GrowthScoreText.Text = growthScore.ToString(CultureInfo.InvariantCulture);
        ActiveGrowthGoalsText.Text = (workspace.GrowthGoals.Count - completedGoals).ToString(CultureInfo.InvariantCulture);
        AverageGrowthText.Text = $"{averageProgress}%";
        WeeklyFocusText.Text = $"{weeklyMinutes} menit";
        ReviewStreakText.Text = $"{reviewStreak} hari";
        if (!MonthlyBudgetInput.IsKeyboardFocusWithin) MonthlyBudgetInput.Text = workspace.Settings.MonthlyBudget.ToString("0", CultureInfo.InvariantCulture);
        HideBalancesInput.IsChecked = workspace.Settings.HideBalances;
    }

    private string Currency(decimal value) => workspace.Settings.HideBalances ? "••••••" : $"Rp {value.ToString("N0", CultureInfo.GetCultureInfo("id-ID"))}";

    private string TodayKey() => DateTime.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private DailyCheckIn TodayCheckIn()
    {
        var key = TodayKey();
        var existing = workspace.LifeOs.CheckIns.FirstOrDefault(item => item.Date.StartsWith(key, StringComparison.Ordinal));
        if (existing is not null) return existing;
        var created = new DailyCheckIn { Id = $"checkin-{key}", Date = key };
        workspace.LifeOs.CheckIns.Insert(0, created);
        return created;
    }

    private void AwardLifeXp(string key, int amount)
    {
        if (workspace.LifeOs.Gamification.LastAwardKeys.Contains(key, StringComparer.Ordinal)) return;
        workspace.LifeOs.Gamification.LastAwardKeys.Add(key);
        workspace.LifeOs.Gamification.TotalXp += amount;
    }

    private void RefreshRitualDays()
    {
        workspace.LifeOs.Gamification.RitualDays = workspace.LifeOs.CheckIns.Where(item => item.MorningCompletedAt is not null || item.EveningCompletedAt is not null).Select(item => item.Date[..Math.Min(10, item.Date.Length)]).Distinct().Order().ToList();
        workspace.LifeOs.Gamification.PerfectDays = workspace.LifeOs.CheckIns.Where(item => item.MorningCompletedAt is not null && item.EveningCompletedAt is not null).Select(item => item.Date[..Math.Min(10, item.Date.Length)]).Distinct().Order().ToList();
    }

    private void StartLifeCycleClick(object sender, RoutedEventArgs e)
    {
        var start = DateTime.Today;
        workspace.LifeOs.Cycle = new LifeCycle { Id = $"cycle-{TodayKey()}", Name = "Siklus 1", StartDate = TodayKey(), EndDate = start.AddDays(83).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), Status = "active" };
        SaveAndRender();
    }

    private void CompleteMorningRitualClick(object sender, RoutedEventArgs e)
    {
        var checkIn = TodayCheckIn();
        checkIn.MorningCompletedAt = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);
        checkIn.Energy ??= 3;
        AwardLifeXp($"morning:{TodayKey()}", 10);
        RefreshRitualDays();
        SaveAndRender();
    }

    private void CompleteEveningRitualClick(object sender, RoutedEventArgs e)
    {
        var checkIn = TodayCheckIn();
        checkIn.EveningCompletedAt = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);
        AwardLifeXp($"evening:{TodayKey()}", 10);
        RefreshRitualDays();
        SaveAndRender();
    }

    private void AddLifePriorityClick(object sender, RoutedEventArgs e)
    {
        var title = LifePriorityInput.Text.Trim();
        if (title.Length == 0) return;
        var key = TodayKey();
        if (workspace.LifeOs.Priorities.Count(item => item.Date.StartsWith(key, StringComparison.Ordinal)) >= 3)
        {
            MessageBox.Show("Maksimal tiga prioritas per hari.", "Daily OS", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        workspace.LifeOs.Priorities.Insert(0, new DailyPriority { Id = Guid.NewGuid().ToString(), Date = key, Text = title });
        LifePriorityInput.Clear();
        SaveAndRender();
    }

    private void ToggleLifePriorityClick(object sender, RoutedEventArgs e)
    {
        if (sender is not CheckBox box || box.Tag is not string id) return;
        var priority = workspace.LifeOs.Priorities.FirstOrDefault(item => item.Id == id);
        if (priority is null) return;
        priority.Done = box.IsChecked == true;
        SaveAndRender();
    }

    private void SaveAndRender()
    {
        store.Save(workspace);
        if (syncConfig.Enabled)
        {
            localChangeVersion++;
            syncConfig.Dirty = true;
            syncConfigStore.Save(syncConfig);
        }
        Render();
        if (syncConfig.Enabled) _ = SyncAsync();
    }

    private async Task SyncAsync(bool useRemote = false, bool forceLocal = false)
    {
        if (syncing || !syncConfig.Enabled) return;
        syncing = true;
        var changeVersion = localChangeVersion;
        SetSyncStatus("Menyinkronkan…", "Menghubungkan data perangkat dengan server pusat.");
        try
        {
            var remote = await syncClient.GetAsync(syncConfig);
            if (remote.StatusCode == HttpStatusCode.Unauthorized)
            {
                SetSyncStatus("Perlu masuk", "Kata sandi server tidak cocok.");
                return;
            }
            if (!remote.IsSuccess) throw new HttpRequestException(remote.Error ?? "Server sinkronisasi tidak dapat dibaca.");

            if (useRemote)
            {
                if (!remote.Exists || remote.Data is null)
                {
                    SetSyncStatus("Server kosong", "Belum ada data yang dapat diambil dari server.");
                    return;
                }
                ApplySynced(remote, changeVersion, overwriteLocal: true);
                return;
            }

            if (forceLocal || !remote.Exists)
            {
                var uploaded = await syncClient.PutAsync(syncConfig, workspace, forceLocal);
                if (uploaded.StatusCode == HttpStatusCode.Unauthorized)
                {
                    SetSyncStatus("Perlu masuk", "Kata sandi server tidak cocok.");
                    return;
                }
                if (!uploaded.IsSuccess) throw new HttpRequestException(uploaded.Error ?? "Data tidak dapat dikirim.");
                ApplySynced(uploaded, changeVersion);
                return;
            }

            if (remote.Revision != syncConfig.Revision)
            {
                if (syncConfig.Dirty)
                {
                    SetSyncStatus("Konflik data", "Server dan perangkat sama-sama berubah. Pilih data server atau data perangkat di Pengaturan.");
                    return;
                }
                ApplySynced(remote, changeVersion);
                return;
            }

            if (syncConfig.Dirty)
            {
                var uploaded = await syncClient.PutAsync(syncConfig, workspace);
                if (uploaded.IsConflict)
                {
                    SetSyncStatus("Konflik data", "Data berubah di perangkat lain. Pilih data server atau data perangkat di Pengaturan.");
                    return;
                }
                if (!uploaded.IsSuccess) throw new HttpRequestException(uploaded.Error ?? "Data tidak dapat dikirim.");
                ApplySynced(uploaded, changeVersion);
                return;
            }

            SetSyncStatus("Tersinkron", $"Semua perangkat memakai revisi {syncConfig.Revision}.");
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or IOException or InvalidDataException)
        {
            SetSyncStatus("Offline · tersimpan lokal", "Perubahan aman di perangkat dan akan dikirim saat server dapat dihubungi.");
        }
        finally
        {
            syncing = false;
            if (syncConfig.Enabled && syncConfig.Dirty && localChangeVersion != changeVersion) _ = SyncAsync();
        }
    }

    private void ApplySynced(SyncResponse result, int expectedChangeVersion, bool overwriteLocal = false)
    {
        if (!overwriteLocal && localChangeVersion != expectedChangeVersion)
        {
            syncConfig.Revision = result.Revision;
            syncConfig.Dirty = true;
            syncConfigStore.Save(syncConfig);
            SetSyncStatus("Perubahan menunggu", "Ada perubahan baru; sinkronisasi dilanjutkan otomatis.");
            return;
        }
        if (result.Data is not null)
        {
            workspace = result.Data;
            store.Save(workspace);
            ClearAllEditors();
            Render();
        }
        syncConfig.Revision = result.Revision;
        syncConfig.Dirty = false;
        syncConfigStore.Save(syncConfig);
        SetSyncStatus("Tersinkron", $"Semua perangkat memakai revisi {result.Revision}.");
    }

    private void SetSyncStatus(string shortLabel, string description)
    {
        SyncStatusText.Text = $"●  {shortLabel}";
        SyncStatusDescription.Text = description;
    }

    private void AddTransactionClick(object sender, RoutedEventArgs e)
    {
        var title = TransactionTitleInput.Text.Trim();
        if (title.Length == 0 || !TryAmount(TransactionAmountInput.Text, out var amount))
        {
            MessageBox.Show("Isi nama dan nominal transaksi yang valid.", "Transaksi", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var date = TransactionDateInput.SelectedDate ?? DateTime.Today;
        var item = new TransactionItem(editingTransactionId ?? Guid.NewGuid().ToString(), title, amount, TransactionKindInput.SelectedIndex == 1, date);
        if (editingTransactionId is string id)
        {
            var index = workspace.Transactions.FindIndex(row => row.Id == id);
            if (index >= 0) workspace.Transactions[index] = item;
        }
        else workspace.Transactions.Add(item);
        ClearTransactionEditor();
        SaveAndRender();
    }

    private void EditTransactionClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id)) return;
        var item = workspace.Transactions.Find(row => row.Id == id);
        if (item is null) return;
        editingTransactionId = id;
        TransactionTitleInput.Text = item.Title;
        TransactionAmountInput.Text = item.Amount.ToString(CultureInfo.InvariantCulture);
        TransactionKindInput.SelectedIndex = item.IsIncome ? 1 : 0;
        TransactionDateInput.SelectedDate = item.Date;
        TransactionSaveButton.Content = "Simpan";
        TransactionCancelButton.Visibility = Visibility.Visible;
        TransactionTitleInput.Focus();
    }

    private void CancelTransactionEditClick(object sender, RoutedEventArgs e) => ClearTransactionEditor();

    private void ClearTransactionEditor()
    {
        editingTransactionId = null;
        TransactionTitleInput.Clear();
        TransactionAmountInput.Clear();
        TransactionKindInput.SelectedIndex = 0;
        TransactionDateInput.SelectedDate = DateTime.Today;
        TransactionSaveButton.Content = "Tambah";
        TransactionCancelButton.Visibility = Visibility.Collapsed;
    }

    private static bool TryAmount(string value, out decimal amount)
    {
        var styles = NumberStyles.Number;
        return (decimal.TryParse(value, styles, CultureInfo.CurrentCulture, out amount)
                || decimal.TryParse(value, styles, CultureInfo.InvariantCulture, out amount))
            && amount > 0;
    }

    private void DeleteTransactionClick(object sender, RoutedEventArgs e) => DeleteById(sender, workspace.Transactions, item => item.Id, "transaksi");

    private void AddAgendaClick(object sender, RoutedEventArgs e)
    {
        var title = AgendaTitleInput.Text.Trim();
        if (title.Length == 0 || AgendaDateInput.SelectedDate is not DateTime date) return;
        var existing = editingAgendaId is string id ? workspace.Agenda.Find(item => item.Id == id) : null;
        var item = new AgendaItem(editingAgendaId ?? Guid.NewGuid().ToString(), title, date.Date, existing?.IsDone ?? false);
        if (editingAgendaId is string editId)
        {
            var index = workspace.Agenda.FindIndex(row => row.Id == editId);
            if (index >= 0) workspace.Agenda[index] = item;
        }
        else workspace.Agenda.Add(item);
        ClearAgendaEditor();
        SaveAndRender();
    }

    private void EditAgendaClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id)) return;
        var item = workspace.Agenda.Find(row => row.Id == id);
        if (item is null) return;
        editingAgendaId = id;
        AgendaTitleInput.Text = item.Title;
        AgendaDateInput.SelectedDate = item.Date;
        AgendaSaveButton.Content = "Simpan";
        AgendaCancelButton.Visibility = Visibility.Visible;
        AgendaTitleInput.Focus();
    }

    private void CancelAgendaEditClick(object sender, RoutedEventArgs e) => ClearAgendaEditor();

    private void ClearAgendaEditor()
    {
        editingAgendaId = null;
        AgendaTitleInput.Clear();
        AgendaDateInput.SelectedDate = DateTime.Today;
        AgendaSaveButton.Content = "Tambahkan";
        AgendaCancelButton.Visibility = Visibility.Collapsed;
    }

    private void ToggleAgendaClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id)) return;
        var index = workspace.Agenda.FindIndex(item => item.Id == id);
        if (index >= 0) workspace.Agenda[index] = workspace.Agenda[index] with { IsDone = !workspace.Agenda[index].IsDone };
        SaveAndRender();
    }

    private void DeleteAgendaClick(object sender, RoutedEventArgs e) => DeleteById(sender, workspace.Agenda, item => item.Id, "agenda");

    private void AddNoteClick(object sender, RoutedEventArgs e)
    {
        var title = NoteTitleInput.Text.Trim();
        var body = NoteBodyInput.Text.Trim();
        if (title.Length == 0 && body.Length == 0) return;
        var item = new NoteItem(editingNoteId ?? Guid.NewGuid().ToString(), title.Length == 0 ? "Catatan" : title, body, DateTime.Now);
        if (editingNoteId is string id)
        {
            var index = workspace.Notes.FindIndex(row => row.Id == id);
            if (index >= 0) workspace.Notes[index] = item;
        }
        else workspace.Notes.Add(item);
        ClearNoteEditor();
        SaveAndRender();
    }

    private void EditNoteClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id)) return;
        var item = workspace.Notes.Find(row => row.Id == id);
        if (item is null) return;
        editingNoteId = id;
        NoteTitleInput.Text = item.Title;
        NoteBodyInput.Text = item.Body;
        NoteSaveButton.Content = "Simpan perubahan";
        NoteCancelButton.Visibility = Visibility.Visible;
        NoteTitleInput.Focus();
    }

    private void CancelNoteEditClick(object sender, RoutedEventArgs e) => ClearNoteEditor();

    private void ClearNoteEditor()
    {
        editingNoteId = null;
        NoteTitleInput.Clear();
        NoteBodyInput.Clear();
        NoteSaveButton.Content = "Simpan catatan";
        NoteCancelButton.Visibility = Visibility.Collapsed;
    }

    private void DeleteNoteClick(object sender, RoutedEventArgs e) => DeleteById(sender, workspace.Notes, item => item.Id, "catatan");

    private void AddHabitClick(object sender, RoutedEventArgs e)
    {
        var name = HabitNameInput.Text.Trim();
        if (name.Length == 0) return;
        if (editingHabitId is string id)
        {
            var index = workspace.Habits.FindIndex(item => item.Id == id);
            if (index >= 0) workspace.Habits[index] = workspace.Habits[index] with { Name = name };
        }
        else workspace.Habits.Add(HabitItem.Create(Guid.NewGuid().ToString(), name));
        ClearHabitEditor();
        SaveAndRender();
    }

    private void EditHabitClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id)) return;
        var item = workspace.Habits.Find(row => row.Id == id);
        if (item is null) return;
        editingHabitId = id;
        HabitNameInput.Text = item.Name;
        HabitSaveButton.Content = "Simpan";
        HabitCancelButton.Visibility = Visibility.Visible;
        HabitNameInput.Focus();
    }

    private void CancelHabitEditClick(object sender, RoutedEventArgs e) => ClearHabitEditor();

    private void ClearHabitEditor()
    {
        editingHabitId = null;
        HabitNameInput.Clear();
        HabitSaveButton.Content = "Tambahkan";
        HabitCancelButton.Visibility = Visibility.Collapsed;
    }

    private void ToggleHabitClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id)) return;
        var index = workspace.Habits.FindIndex(item => item.Id == id);
        if (index >= 0) workspace.Habits[index] = workspace.Habits[index].ToggleToday();
        SaveAndRender();
    }

    private void DeleteHabitClick(object sender, RoutedEventArgs e) => DeleteById(sender, workspace.Habits, item => item.Id, "kebiasaan");

    private void ProjectBoardChanged(object sender, SelectionChangedEventArgs e)
    {
        if (renderingProjects || ProjectBoardInput.SelectedItem is not ProjectBoard project) return;
        selectedProjectId = project.Id;
        ClearTicketEditor();
        Render();
    }

    private void AddProjectClick(object sender, RoutedEventArgs e)
    {
        var name = ProjectNameInput.Text.Trim();
        if (name.Length == 0)
        {
            MessageBox.Show("Isi nama proyek terlebih dahulu.", "Proyek", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var project = new ProjectBoard(Guid.NewGuid().ToString(), name, ProjectDescriptionInput.Text.Trim(), "#2563EB", false, DateTime.Now).Normalize();
        workspace.Projects.Add(project);
        selectedProjectId = project.Id;
        ProjectNameInput.Clear();
        ProjectDescriptionInput.Clear();
        SaveAndRender();
    }

    private void ArchiveProjectClick(object sender, RoutedEventArgs e)
    {
        var index = workspace.Projects.FindIndex(item => item.Id == selectedProjectId && !item.Archived);
        if (index < 0) return;
        if (MessageBox.Show("Arsipkan proyek ini? Ticket tetap aman dan tersinkron.", "Arsip proyek", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        workspace.Projects[index] = workspace.Projects[index] with { Archived = true };
        selectedProjectId = workspace.Projects.FirstOrDefault(item => !item.Archived)?.Id ?? "";
        ClearTicketEditor();
        SaveAndRender();
    }

    private void SaveTicketClick(object sender, RoutedEventArgs e)
    {
        var title = TicketTitleInput.Text.Trim();
        if (selectedProjectId.Length == 0 || title.Length == 0)
        {
            MessageBox.Show(selectedProjectId.Length == 0 ? "Buat proyek sebelum menambah ticket." : "Isi judul ticket.", "Ticket", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var existing = editingTicketId is string id ? workspace.Tickets.Find(item => item.Id == id) : null;
        var status = (TicketStatusInput.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "backlog";
        var priority = (TicketPriorityInput.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "medium";
        var labels = TicketLabelsInput.Text.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).Distinct(StringComparer.CurrentCultureIgnoreCase).Take(10).ToList();
        var dueDate = TicketDueInput.SelectedDate is DateTime due ? DateOnly.FromDateTime(due).ToString("O") : "";
        var now = DateTime.Now;
        var ticket = new KanbanTicket(
            existing?.Id ?? Guid.NewGuid().ToString(), selectedProjectId, title, TicketDescriptionInput.Text.Trim(), status, priority, labels,
            dueDate, existing?.Checklist ?? [], existing?.Comments ?? [], (TicketAgendaInput.SelectedItem as AgendaItem)?.Id,
            (TicketGrowthInput.SelectedItem as GrowthGoal)?.Id, existing?.Archived ?? false,
            existing?.Order ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), existing?.CreatedAt ?? now, now).Normalize();
        if (existing is null) workspace.Tickets.Add(ticket);
        else workspace.Tickets[workspace.Tickets.IndexOf(existing)] = ticket;
        editingTicketId = ticket.Id;
        TicketFormTitle.Text = "Ubah ticket";
        TicketSaveButton.Content = "Simpan";
        TicketCancelButton.Visibility = Visibility.Visible;
        TicketArchiveButton.Visibility = Visibility.Visible;
        TicketDeleteButton.Visibility = Visibility.Visible;
        SaveAndRender();
    }

    private void EditTicketClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id)) return;
        var item = workspace.Tickets.Find(row => row.Id == id);
        if (item is null) return;
        editingTicketId = id;
        selectedProjectId = item.ProjectId;
        TicketTitleInput.Text = item.Title;
        TicketDescriptionInput.Text = item.Description;
        SelectTaggedItem(TicketStatusInput, item.Status);
        SelectTaggedItem(TicketPriorityInput, item.Priority);
        TicketDueInput.SelectedDate = DateOnly.TryParseExact(item.DueDate, "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out var due) ? due.ToDateTime(TimeOnly.MinValue) : null;
        TicketLabelsInput.Text = string.Join(", ", item.Labels);
        TicketAgendaInput.SelectedItem = workspace.Agenda.FirstOrDefault(row => row.Id == item.LinkedScheduleId);
        TicketGrowthInput.SelectedItem = workspace.GrowthGoals.FirstOrDefault(row => row.Id == item.LinkedGrowthGoalId);
        TicketFormTitle.Text = "Ubah ticket";
        TicketSaveButton.Content = "Simpan";
        TicketCancelButton.Visibility = Visibility.Visible;
        TicketArchiveButton.Visibility = Visibility.Visible;
        TicketDeleteButton.Visibility = Visibility.Visible;
        TicketDetailPanel.Visibility = Visibility.Visible;
        TicketChecklistList.ItemsSource = item.Checklist.ToList();
        TicketCommentList.ItemsSource = item.Comments.OrderByDescending(comment => comment.CreatedAt).ToList();
        TicketTitleInput.Focus();
    }

    private static void SelectTaggedItem(ComboBox comboBox, string tag)
    {
        comboBox.SelectedItem = comboBox.Items.Cast<ComboBoxItem>().FirstOrDefault(item => string.Equals(item.Tag?.ToString(), tag, StringComparison.Ordinal));
    }

    private void CancelTicketEditClick(object sender, RoutedEventArgs e) => ClearTicketEditor();

    private void ClearTicketEditor()
    {
        editingTicketId = null;
        TicketTitleInput.Clear();
        TicketDescriptionInput.Clear();
        TicketLabelsInput.Clear();
        TicketDueInput.SelectedDate = null;
        TicketStatusInput.SelectedIndex = 0;
        TicketPriorityInput.SelectedIndex = 1;
        TicketAgendaInput.SelectedItem = null;
        TicketGrowthInput.SelectedItem = null;
        TicketChecklistInput.Clear();
        TicketCommentInput.Clear();
        TicketFormTitle.Text = "Ticket baru";
        TicketSaveButton.Content = "Buat ticket";
        TicketCancelButton.Visibility = Visibility.Collapsed;
        TicketArchiveButton.Visibility = Visibility.Collapsed;
        TicketDeleteButton.Visibility = Visibility.Collapsed;
        TicketDetailPanel.Visibility = Visibility.Collapsed;
    }

    private void ArchiveTicketClick(object sender, RoutedEventArgs e)
    {
        var index = workspace.Tickets.FindIndex(item => item.Id == editingTicketId);
        if (index < 0) return;
        workspace.Tickets[index] = workspace.Tickets[index] with { Archived = true, UpdatedAt = DateTime.Now };
        ClearTicketEditor();
        SaveAndRender();
    }

    private void DeleteTicketClick(object sender, RoutedEventArgs e)
    {
        if (editingTicketId is not string id) return;
        if (MessageBox.Show("Hapus ticket beserta checklist dan komentarnya?", "Hapus ticket", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        workspace.Tickets.RemoveAll(item => item.Id == id);
        ClearTicketEditor();
        SaveAndRender();
    }

    private void MoveTicketLeftClick(object sender, RoutedEventArgs e) => MoveTicket(sender, -1);
    private void MoveTicketRightClick(object sender, RoutedEventArgs e) => MoveTicket(sender, 1);

    private void MoveTicket(object sender, int direction)
    {
        if (!TryId(sender, out var id)) return;
        var index = workspace.Tickets.FindIndex(item => item.Id == id);
        if (index < 0) return;
        var statusIndex = Math.Max(0, Array.IndexOf(KanbanValues.Statuses, workspace.Tickets[index].Status));
        var nextIndex = Math.Clamp(statusIndex + direction, 0, KanbanValues.Statuses.Length - 1);
        if (nextIndex == statusIndex) return;
        workspace.Tickets[index] = workspace.Tickets[index] with { Status = KanbanValues.Statuses[nextIndex], UpdatedAt = DateTime.Now };
        SaveAndRender();
    }

    private void AddTicketChecklistClick(object sender, RoutedEventArgs e)
    {
        var text = TicketChecklistInput.Text.Trim();
        var index = workspace.Tickets.FindIndex(item => item.Id == editingTicketId);
        if (index < 0 || text.Length == 0) return;
        workspace.Tickets[index].Checklist.Add(new TicketChecklistItem(Guid.NewGuid().ToString(), text, false));
        workspace.Tickets[index] = workspace.Tickets[index] with { UpdatedAt = DateTime.Now };
        TicketChecklistInput.Clear();
        SaveAndRender();
    }

    private void ToggleTicketChecklistClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id) || editingTicketId is null) return;
        var ticketIndex = workspace.Tickets.FindIndex(item => item.Id == editingTicketId);
        if (ticketIndex < 0) return;
        var checklistIndex = workspace.Tickets[ticketIndex].Checklist.FindIndex(item => item.Id == id);
        if (checklistIndex < 0) return;
        var item = workspace.Tickets[ticketIndex].Checklist[checklistIndex];
        workspace.Tickets[ticketIndex].Checklist[checklistIndex] = item with { Done = !item.Done };
        workspace.Tickets[ticketIndex] = workspace.Tickets[ticketIndex] with { UpdatedAt = DateTime.Now };
        SaveAndRender();
    }

    private void AddTicketCommentClick(object sender, RoutedEventArgs e)
    {
        var body = TicketCommentInput.Text.Trim();
        var index = workspace.Tickets.FindIndex(item => item.Id == editingTicketId);
        if (index < 0 || body.Length == 0) return;
        workspace.Tickets[index].Comments.Add(new TicketComment(Guid.NewGuid().ToString(), body, DateTime.Now));
        workspace.Tickets[index] = workspace.Tickets[index] with { UpdatedAt = DateTime.Now };
        TicketCommentInput.Clear();
        SaveAndRender();
    }

    private void AddGrowthGoalClick(object sender, RoutedEventArgs e)
    {
        var title = GrowthGoalTitleInput.Text.Trim();
        if (title.Length == 0 || !int.TryParse(GrowthGoalProgressInput.Text, out var progress))
        {
            MessageBox.Show("Isi tujuan dan progres 0–100.", "Perkembangan", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var existing = editingGrowthGoalId is string id ? workspace.GrowthGoals.Find(item => item.Id == id) : null;
        var targetDate = GrowthGoalTargetInput.SelectedDate is DateTime target ? DateOnly.FromDateTime(target).ToString("O") : "";
        var item = new GrowthGoal(
            editingGrowthGoalId ?? Guid.NewGuid().ToString(),
            title,
            GrowthAreas.Values[Math.Clamp(GrowthGoalAreaInput.SelectedIndex, 0, GrowthAreas.Values.Length - 1)],
            Math.Clamp(progress, 0, 100),
            targetDate,
            GrowthGoalNextActionInput.Text.Trim(),
            existing?.CreatedAt ?? DateTime.Now);
        if (editingGrowthGoalId is string editId)
        {
            var index = workspace.GrowthGoals.FindIndex(row => row.Id == editId);
            if (index >= 0) workspace.GrowthGoals[index] = item;
        }
        else workspace.GrowthGoals.Insert(0, item);
        ClearGrowthGoalEditor();
        SaveAndRender();
    }

    private void EditGrowthGoalClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id)) return;
        var item = workspace.GrowthGoals.Find(row => row.Id == id);
        if (item is null) return;
        editingGrowthGoalId = id;
        GrowthGoalTitleInput.Text = item.Title;
        GrowthGoalAreaInput.SelectedIndex = Math.Max(0, Array.IndexOf(GrowthAreas.Values, item.Area));
        GrowthGoalProgressInput.Text = item.Progress.ToString(CultureInfo.InvariantCulture);
        GrowthGoalTargetInput.SelectedDate = DateOnly.TryParseExact(item.TargetDate, "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? date.ToDateTime(TimeOnly.MinValue) : null;
        GrowthGoalNextActionInput.Text = item.NextAction;
        GrowthGoalSaveButton.Content = "Simpan";
        GrowthGoalCancelButton.Visibility = Visibility.Visible;
        GrowthGoalTitleInput.Focus();
    }

    private void CancelGrowthGoalEditClick(object sender, RoutedEventArgs e) => ClearGrowthGoalEditor();

    private void ClearGrowthGoalEditor()
    {
        editingGrowthGoalId = null;
        GrowthGoalTitleInput.Clear();
        GrowthGoalAreaInput.SelectedIndex = 1;
        GrowthGoalProgressInput.Text = "0";
        GrowthGoalTargetInput.SelectedDate = null;
        GrowthGoalNextActionInput.Clear();
        GrowthGoalSaveButton.Content = "Tambah";
        GrowthGoalCancelButton.Visibility = Visibility.Collapsed;
    }

    private void AdvanceGrowthGoalClick(object sender, RoutedEventArgs e)
    {
        if (!TryId(sender, out var id)) return;
        var index = workspace.GrowthGoals.FindIndex(item => item.Id == id);
        if (index >= 0) workspace.GrowthGoals[index] = workspace.GrowthGoals[index] with { Progress = Math.Min(100, workspace.GrowthGoals[index].Progress + 10) };
        SaveAndRender();
    }

    private void DeleteGrowthGoalClick(object sender, RoutedEventArgs e) => DeleteById(sender, workspace.GrowthGoals, item => item.Id, "tujuan perkembangan");

    private void AddFocusSessionClick(object sender, RoutedEventArgs e)
    {
        var title = FocusTitleInput.Text.Trim();
        if (title.Length == 0 || !int.TryParse(FocusMinutesInput.Text, out var minutes) || minutes <= 0)
        {
            MessageBox.Show("Isi aktivitas dan durasi yang valid.", "Fokus", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        workspace.FocusSessions.Insert(0, new FocusSession(
            Guid.NewGuid().ToString(),
            title,
            GrowthAreas.Values[Math.Clamp(FocusAreaInput.SelectedIndex, 0, GrowthAreas.Values.Length - 1)],
            Math.Clamp(minutes, 1, 1440),
            (FocusDateInput.SelectedDate ?? DateTime.Today).Date,
            FocusNoteInput.Text.Trim()));
        FocusTitleInput.Clear();
        FocusMinutesInput.Text = "30";
        FocusDateInput.SelectedDate = DateTime.Today;
        FocusNoteInput.Clear();
        SaveAndRender();
    }

    private void DeleteFocusSessionClick(object sender, RoutedEventArgs e) => DeleteById(sender, workspace.FocusSessions, item => item.Id, "sesi fokus");

    private void AddDailyReviewClick(object sender, RoutedEventArgs e)
    {
        var date = (ReviewDateInput.SelectedDate ?? DateTime.Today).Date;
        var existing = workspace.DailyReviews.Find(item => item.Date.Date == date);
        var review = new DailyReview(
            existing?.Id ?? Guid.NewGuid().ToString(),
            date,
            ReviewMoodInput.SelectedIndex + 1,
            ReviewEnergyInput.SelectedIndex + 1,
            ReviewWinInput.Text.Trim(),
            ReviewLessonInput.Text.Trim(),
            ReviewNextStepInput.Text.Trim());
        if (existing is null) workspace.DailyReviews.Insert(0, review);
        else workspace.DailyReviews[workspace.DailyReviews.IndexOf(existing)] = review;
        ReviewWinInput.Clear();
        ReviewLessonInput.Clear();
        ReviewNextStepInput.Clear();
        SaveAndRender();
    }

    private void DeleteDailyReviewClick(object sender, RoutedEventArgs e) => DeleteById(sender, workspace.DailyReviews, item => item.Id, "refleksi");

    private void DeleteById<T>(object sender, List<T> items, Func<T, string> id, string label)
    {
        if (!TryId(sender, out var value)) return;
        if (MessageBox.Show($"Hapus {label} ini?", "Konfirmasi", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        items.RemoveAll(item => id(item) == value);
        SaveAndRender();
    }

    private static bool TryId(object sender, out string id)
    {
        id = "";
        if (sender is not FrameworkElement { Tag: string value } || string.IsNullOrWhiteSpace(value)) return false;
        id = value;
        return true;
    }

    private void SearchInputChanged(object sender, TextChangedEventArgs e)
    {
        if (!IsLoaded || currentPage == "overview") return;
        Render();
    }

    private void ExportBackupClick(object sender, RoutedEventArgs e)
    {
        var dialog = new SaveFileDialog
        {
            Title = "Ekspor cadangan Marco Life OS",
            FileName = $"personal-command-center-{DateTime.Today:yyyy-MM-dd}.json",
            Filter = "Cadangan JSON (*.json)|*.json"
        };
        if (dialog.ShowDialog(this) != true) return;
        try
        {
            File.WriteAllText(dialog.FileName, WorkspaceStore.Serialize(workspace));
            MessageBox.Show("Cadangan berhasil disimpan.", "Cadangan", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (IOException error)
        {
            MessageBox.Show($"Cadangan tidak dapat disimpan. {error.Message}", "Cadangan", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void ImportBackupClick(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog { Title = "Impor cadangan Marco Life OS", Filter = "Cadangan JSON (*.json)|*.json" };
        if (dialog.ShowDialog(this) != true) return;
        try
        {
            var imported = WorkspaceStore.Deserialize(File.ReadAllText(dialog.FileName));
            if (MessageBox.Show("Ganti data saat ini dengan isi cadangan?", "Impor cadangan", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
            workspace = imported;
            ClearAllEditors();
            SaveAndRender();
        }
        catch (Exception error) when (error is IOException or JsonException or InvalidDataException)
        {
            MessageBox.Show($"Cadangan tidak valid. {error.Message}", "Impor cadangan", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void ClearAllEditors()
    {
        ClearTransactionEditor();
        ClearAgendaEditor();
        ClearNoteEditor();
        ClearHabitEditor();
        ClearGrowthGoalEditor();
        ClearTicketEditor();
    }

    private void SaveSettingsClick(object sender, RoutedEventArgs e)
    {
        var raw = MonthlyBudgetInput.Text.Trim();
        var valid = raw.Length == 0
            || decimal.TryParse(raw, NumberStyles.Number, CultureInfo.CurrentCulture, out _)
            || decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out _);
        if (!valid)
        {
            MessageBox.Show("Anggaran bulanan harus berupa angka yang valid.", "Pengaturan", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        decimal.TryParse(raw, NumberStyles.Number, CultureInfo.CurrentCulture, out var budget);
        if (budget == 0) decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out budget);
        workspace.Settings.MonthlyBudget = Math.Max(0, budget);
        workspace.Settings.HideBalances = HideBalancesInput.IsChecked == true;
        SaveAndRender();
        MessageBox.Show("Pengaturan disimpan.", "Pengaturan", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private async void SaveSyncSettingsClick(object sender, RoutedEventArgs e)
    {
        var rawUrl = SyncServerInput.Text.Trim();
        if (rawUrl.Length == 0)
        {
            syncConfig = new();
            syncConfigStore.Save(syncConfig);
            SyncPasswordInput.Clear();
            SetSyncStatus("Tersimpan lokal", "Sinkronisasi dinonaktifkan pada perangkat ini.");
            return;
        }
        if (!SyncConfig.TryNormalizeUrl(rawUrl, out var serverUrl))
        {
            MessageBox.Show("Gunakan alamat HTTPS. HTTP hanya diperbolehkan untuk localhost.", "Sinkronisasi", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var serverChanged = !string.Equals(syncConfig.ServerUrl, serverUrl, StringComparison.OrdinalIgnoreCase);
        syncConfig.ServerUrl = serverUrl;
        if (SyncPasswordInput.Password.Length > 0) syncConfig.Password = SyncPasswordInput.Password;
        if (serverChanged)
        {
            syncConfig.Revision = 0;
            syncConfig.Dirty = true;
        }
        syncConfigStore.Save(syncConfig);
        SyncServerInput.Text = serverUrl;
        SyncPasswordInput.Clear();
        await SyncAsync();
    }

    private async void SyncNowClick(object sender, RoutedEventArgs e) => await SyncAsync();

    private async void UseServerDataClick(object sender, RoutedEventArgs e)
    {
        if (!syncConfig.Enabled) return;
        if (MessageBox.Show("Ganti data lokal dengan data terbaru dari server?", "Sinkronisasi", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        await SyncAsync(useRemote: true);
    }

    private async void UploadLocalDataClick(object sender, RoutedEventArgs e)
    {
        if (!syncConfig.Enabled) return;
        if (MessageBox.Show("Kirim data perangkat ini dan ganti data bersama di server?", "Sinkronisasi", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        await SyncAsync(forceLocal: true);
    }

    private void ResetDataClick(object sender, RoutedEventArgs e)
    {
        if (MessageBox.Show("Ganti data saat ini dengan data demo?", "Pulihkan data demo", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        workspace = Workspace.CreateDemo();
        ClearAllEditors();
        SaveAndRender();
    }
}
