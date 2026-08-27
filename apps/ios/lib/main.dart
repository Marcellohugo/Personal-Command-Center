import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'workspace.dart';

const ink = Color(0xff0b1f3a);
const moss = Color(0xff2563eb);
const clay = Color(0xff0f7ae5);
const paper = Color(0xfff4f7fc);
const danger = Color(0xffd65368);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = LocalWorkspaceStore();
  final syncStore = SyncConfigStore();
  final workspace = await store.load();
  runApp(
    CommandCenterApp(store: store, syncStore: syncStore, workspace: workspace),
  );
}

class CommandCenterApp extends StatelessWidget {
  const CommandCenterApp({
    super.key,
    required this.store,
    required this.syncStore,
    required this.workspace,
  });
  final LocalWorkspaceStore store;
  final SyncConfigStore syncStore;
  final WorkspaceData workspace;

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: moss,
      brightness: Brightness.light,
      surface: paper,
    );
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Marco Life OS',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: paper,
        fontFamily: '.SF Pro Text',
        cardTheme: const CardThemeData(
          color: Colors.white,
          elevation: 0,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(22)),
            side: BorderSide(color: Color(0xffdce6f2)),
          ),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: paper,
          surfaceTintColor: Colors.transparent,
          foregroundColor: ink,
          elevation: 0,
        ),
        navigationBarTheme: const NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: Color(0xffdbeafe),
          elevation: 8,
          shadowColor: Color(0x180b1f3a),
        ),
        floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: ink,
          foregroundColor: Colors.white,
          elevation: 5,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xffdce6f2)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xffdce6f2)),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
        ),
      ),
      home: AppLockGate(
        builder: (lock, changePin) => HomeScreen(
          store: store,
          syncStore: syncStore,
          initialWorkspace: workspace,
          onLock: lock,
          onChangePin: changePin,
        ),
      ),
    );
  }
}

class AppLockGate extends StatefulWidget {
  const AppLockGate({super.key, required this.builder});
  final Widget Function(VoidCallback lock, VoidCallback changePin) builder;

  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> with WidgetsBindingObserver {
  final store = AppLockStore();
  final pin = TextEditingController();
  final confirmation = TextEditingController();
  bool loading = true;
  bool configured = false;
  bool unlocked = false;
  bool saving = false;
  bool changingPin = false;
  int failures = 0;
  DateTime? blockedUntil;
  String error = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(loadLock());
  }

  Future<void> loadLock() async {
    configured = await store.isConfigured();
    if (mounted) setState(() => loading = false);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (configured &&
        (state == AppLifecycleState.inactive ||
            state == AppLifecycleState.paused ||
            state == AppLifecycleState.hidden)) {
      lock();
    }
  }

  void lock() {
    if (!mounted) return;
    pin.clear();
    confirmation.clear();
    setState(() {
      unlocked = false;
      error = '';
    });
  }

  void changePin() {
    pin.clear();
    confirmation.clear();
    setState(() {
      configured = false;
      unlocked = false;
      changingPin = true;
      error = '';
    });
  }

  Future<void> submit() async {
    if (saving) return;
    if (!isValidAppPin(pin.text)) {
      setState(() => error = 'PIN harus berisi tepat 6 angka.');
      return;
    }
    if (!configured && pin.text != confirmation.text) {
      setState(() => error = 'Konfirmasi PIN belum sama.');
      return;
    }
    final now = DateTime.now();
    if (blockedUntil != null && blockedUntil!.isAfter(now)) {
      setState(
        () => error =
            'Terlalu banyak percobaan. Coba lagi dalam ${blockedUntil!.difference(now).inSeconds + 1} detik.',
      );
      return;
    }

    setState(() {
      saving = true;
      error = '';
    });
    try {
      if (!configured) {
        await store.save(pin.text);
        configured = true;
        changingPin = false;
        failures = 0;
        setState(() => unlocked = true);
        return;
      }
      if (await store.verify(pin.text)) {
        failures = 0;
        setState(() => unlocked = true);
        return;
      }
      failures += 1;
      pin.clear();
      if (failures >= 5) {
        failures = 0;
        blockedUntil = now.add(const Duration(seconds: 30));
        setState(
          () => error =
              'Terlalu banyak percobaan. Aplikasi dikunci selama 30 detik.',
        );
      } else {
        setState(
          () => error = 'PIN tidak cocok. Tersisa ${5 - failures} percobaan.',
        );
      }
    } on PlatformException {
      setState(
        () => error = 'PIN belum dapat disimpan dengan aman. Coba lagi.',
      );
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    pin.dispose();
    confirmation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(
        backgroundColor: ink,
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }
    if (unlocked) return widget.builder(lock, changePin);

    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xff061225), Color(0xff0b3d91), Color(0xff2563eb)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(22),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: moss,
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: const Icon(
                            Icons.lock_rounded,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                        const SizedBox(height: 24),
                        const Text(
                          'PERSONAL COMMAND CENTER',
                          style: TextStyle(
                            color: clay,
                            fontSize: 11,
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          configured
                              ? 'Buka aplikasi'
                              : changingPin
                              ? 'Ganti PIN'
                              : 'Buat PIN keamanan',
                          style: const TextStyle(
                            color: ink,
                            fontSize: 29,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          configured
                              ? 'Masukkan PIN perangkat untuk membuka seluruh workspace.'
                              : changingPin
                              ? 'Buat PIN 6 digit baru untuk perangkat ini.'
                              : 'Tanpa akun atau sign in. PIN ini hanya berlaku di perangkat Anda.',
                          style: const TextStyle(
                            color: Color(0xff66768d),
                            height: 1.45,
                          ),
                        ),
                        const SizedBox(height: 22),
                        TextField(
                          controller: pin,
                          autofocus: true,
                          obscureText: true,
                          keyboardType: TextInputType.number,
                          textInputAction: configured
                              ? TextInputAction.done
                              : TextInputAction.next,
                          maxLength: 6,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          onSubmitted: configured ? (_) => submit() : null,
                          decoration: const InputDecoration(
                            labelText: 'PIN 6 digit',
                            counterText: '',
                            prefixIcon: Icon(Icons.pin_outlined),
                          ),
                        ),
                        if (!configured) ...[
                          const SizedBox(height: 12),
                          TextField(
                            controller: confirmation,
                            obscureText: true,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.done,
                            maxLength: 6,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                            onSubmitted: (_) => submit(),
                            decoration: const InputDecoration(
                              labelText: 'Ulangi PIN',
                              counterText: '',
                              prefixIcon: Icon(Icons.verified_user_outlined),
                            ),
                          ),
                        ],
                        if (error.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(
                            error,
                            style: const TextStyle(
                              color: danger,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: FilledButton.icon(
                            onPressed: saving ? null : submit,
                            icon: const Icon(Icons.lock_open_rounded),
                            label: Text(
                              saving
                                  ? 'Mengamankan…'
                                  : configured
                                  ? 'Buka dengan aman'
                                  : 'Simpan & buka',
                            ),
                          ),
                        ),
                        const SizedBox(height: 15),
                        const Center(
                          child: Text(
                            'PIN dilindungi Keychain dan terkunci otomatis saat aplikasi ditinggalkan.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xff7b889b),
                              fontSize: 11,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.store,
    required this.syncStore,
    required this.initialWorkspace,
    required this.onLock,
    required this.onChangePin,
  });
  final LocalWorkspaceStore store;
  final SyncConfigStore syncStore;
  final WorkspaceData initialWorkspace;
  final VoidCallback onLock;
  final VoidCallback onChangePin;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late WorkspaceData workspace = widget.initialWorkspace;
  final syncClient = NativeSyncClient();
  SyncConfig syncConfig = const SyncConfig();
  String syncLabel = 'Lokal';
  String syncDescription = 'Data tersimpan di perangkat ini.';
  bool syncing = false;
  int localChangeVersion = 0;
  String get syncShortLabel => syncLabel == 'Tersinkron'
      ? 'Sinkron'
      : syncLabel.startsWith('Offline')
      ? 'Offline'
      : syncLabel.contains('Konflik')
      ? 'Konflik'
      : syncLabel.contains('masuk')
      ? 'Masuk'
      : syncConfig.enabled
      ? 'Proses'
      : 'Lokal';
  int section = 0;
  String searchQuery = '';
  String selectedProjectId = '';
  bool showArchivedTickets = false;

  static const titles = [
    'Ringkasan',
    'Transaksi',
    'Agenda',
    'Catatan',
    'Kebiasaan',
    'Proyek',
    'Perkembangan',
  ];
  static const subtitles = [
    'Semua yang penting untuk hari ini.',
    'Catat arus uang tanpa koneksi internet.',
    'Susun kegiatan dan tandai yang selesai.',
    'Simpan ide penting dalam workspace bersama.',
    'Bangun ritme kecil yang konsisten.',
    'Gerakkan pekerjaan lewat board ticket yang terarah.',
    'Ukur tujuan, fokus, refleksi, dan momentum Anda.',
  ];
  static const dailyMessages = [
    'Satu langkah kecil hari ini tetap mengubah arah hidupmu.',
    'Kemajuan tumbuh saat niat diberi waktu dan tindakan.',
    'Tidak perlu sempurna—cukup hadir dan bergerak lagi.',
    'Energi mengikuti kejelasan. Pilih satu hal, lalu mulai.',
    'Konsistensi yang tenang akan mengalahkan semangat sesaat.',
    'Rayakan yang sudah maju, lalu lanjutkan satu langkah lagi.',
    'Masa depan dibangun dari keputusan kecil yang kamu tepati.',
  ];

  @override
  void initState() {
    super.initState();
    unawaited(initializeSync());
  }

  Future<void> initializeSync() async {
    syncConfig = await widget.syncStore.load();
    if (!mounted) return;
    setState(() {
      syncLabel = syncConfig.enabled ? 'Menghubungkan…' : 'Lokal';
      syncDescription = syncConfig.enabled
          ? 'Menghubungkan ke server pusat.'
          : 'Isi alamat server di Pengaturan agar data tersinkron.';
    });
    await syncNow();
  }

  void mutate(VoidCallback change) {
    setState(change);
    localChangeVersion += 1;
    unawaited(saveAndSync());
  }

  Future<void> saveAndSync() async {
    await widget.store.save(workspace);
    if (!syncConfig.enabled) return;
    syncConfig = syncConfig.copyWith(dirty: true);
    await widget.syncStore.saveState(syncConfig);
    await syncNow();
  }

  void setSyncStatus(String label, String description) {
    if (!mounted) return;
    setState(() {
      syncLabel = label;
      syncDescription = description;
    });
  }

  Future<void> syncNow({
    bool useRemote = false,
    bool forceLocal = false,
  }) async {
    if (syncing || !syncConfig.enabled) return;
    syncing = true;
    final changeVersion = localChangeVersion;
    setSyncStatus('Menyinkronkan…', 'Menghubungkan data dengan server pusat.');
    try {
      final remote = await syncClient.get(syncConfig);
      if (remote.statusCode == 401) {
        setSyncStatus('Perlu masuk', 'Kata sandi server tidak cocok.');
        return;
      }
      if (!remote.isSuccess) throw const FormatException('Server gagal.');

      if (useRemote) {
        if (!remote.exists || remote.data == null) {
          setSyncStatus('Server kosong', 'Belum ada data di server.');
          return;
        }
        await applySynced(remote, changeVersion, overwriteLocal: true);
        return;
      }

      if (forceLocal || !remote.exists) {
        final uploaded = await syncClient.put(
          syncConfig,
          workspace,
          force: forceLocal,
        );
        if (uploaded.statusCode == 401) {
          setSyncStatus('Perlu masuk', 'Kata sandi server tidak cocok.');
          return;
        }
        if (!uploaded.isSuccess) throw const FormatException('Upload gagal.');
        await applySynced(uploaded, changeVersion);
        return;
      }

      if (remote.revision != syncConfig.revision) {
        if (syncConfig.dirty) {
          setSyncStatus(
            'Konflik data',
            'Server dan perangkat sama-sama berubah. Pilih sumber data di menu.',
          );
          return;
        }
        await applySynced(remote, changeVersion);
        return;
      }

      if (syncConfig.dirty) {
        final uploaded = await syncClient.put(syncConfig, workspace);
        if (uploaded.isConflict) {
          setSyncStatus(
            'Konflik data',
            'Data berubah di perangkat lain. Pilih sumber data di menu.',
          );
          return;
        }
        if (!uploaded.isSuccess) throw const FormatException('Upload gagal.');
        await applySynced(uploaded, changeVersion);
        return;
      }
      setSyncStatus(
        'Tersinkron',
        'Semua perangkat memakai revisi ${syncConfig.revision}.',
      );
    } catch (_) {
      setSyncStatus(
        'Offline · lokal',
        'Perubahan aman dan akan dikirim ketika server tersedia.',
      );
    } finally {
      syncing = false;
      if (syncConfig.enabled &&
          syncConfig.dirty &&
          localChangeVersion != changeVersion) {
        unawaited(syncNow());
      }
    }
  }

  Future<void> applySynced(
    SyncResponse response,
    int expectedChangeVersion, {
    bool overwriteLocal = false,
  }) async {
    if (!overwriteLocal && localChangeVersion != expectedChangeVersion) {
      syncConfig = syncConfig.copyWith(
        revision: response.revision,
        dirty: true,
      );
      await widget.syncStore.saveState(syncConfig);
      setSyncStatus(
        'Perubahan menunggu',
        'Ada perubahan baru; sinkronisasi dilanjutkan otomatis.',
      );
      return;
    }
    if (response.data != null) {
      workspace = response.data!;
      await widget.store.save(workspace);
    }
    syncConfig = syncConfig.copyWith(revision: response.revision, dirty: false);
    await widget.syncStore.saveState(syncConfig);
    setSyncStatus(
      'Tersinkron',
      'Semua perangkat memakai revisi ${response.revision}.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      overview(),
      transactions(),
      agenda(),
      notes(),
      habits(),
      projects(),
      growth(),
    ];
    return Scaffold(
      appBar: AppBar(
        backgroundColor: paper,
        surfaceTintColor: Colors.transparent,
        leadingWidth: 66,
        leading: Padding(
          padding: const EdgeInsets.only(left: 18, top: 8, bottom: 8),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(13),
            child: Image.asset('assets/app-icon-blue.png'),
          ),
        ),
        titleSpacing: 12,
        toolbarHeight: 76,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'PERSONAL COMMAND CENTER',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.3,
                color: clay,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              titles[section],
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: ink,
              ),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 10),
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
            decoration: BoxDecoration(
              color: const Color(0xffe9f2ff),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Icon(
                  syncLabel == 'Tersinkron'
                      ? Icons.cloud_done_rounded
                      : syncLabel.startsWith('Offline')
                      ? Icons.cloud_off_rounded
                      : Icons.sync_rounded,
                  size: 15,
                  color: moss,
                ),
                const SizedBox(width: 6),
                Text(
                  syncShortLabel,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: moss,
                  ),
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            onSelected: (value) async {
              if (value == 'lock') widget.onLock();
              if (value == 'change_pin') widget.onChangePin();
              if (value == 'settings') await showSettings();
              if (value == 'sync') await syncNow();
              if (value == 'use_remote') await useServerData();
              if (value == 'force_local') await uploadLocalData();
              if (value == 'export') await exportBackup();
              if (value == 'import') await importBackup();
              if (value == 'reset') await resetDemo();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'lock', child: Text('Kunci aplikasi')),
              PopupMenuItem(value: 'change_pin', child: Text('Ganti PIN')),
              PopupMenuItem(value: 'settings', child: Text('Pengaturan')),
              PopupMenuItem(value: 'sync', child: Text('Sinkronkan sekarang')),
              PopupMenuItem(
                value: 'use_remote',
                child: Text('Gunakan data server'),
              ),
              PopupMenuItem(
                value: 'force_local',
                child: Text('Kirim data perangkat'),
              ),
              PopupMenuItem(value: 'export', child: Text('Salin cadangan')),
              PopupMenuItem(
                value: 'import',
                child: Text('Pulihkan dari clipboard'),
              ),
              PopupMenuItem(value: 'reset', child: Text('Pulihkan data demo')),
            ],
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(30),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      searchQuery.isEmpty
                          ? subtitles[section]
                          : 'Hasil pencarian “$searchQuery”',
                      style: const TextStyle(
                        color: Color(0xff66768d),
                        fontSize: 13,
                      ),
                    ),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: searchQuery.isEmpty
                        ? showSearchDialog
                        : () => setState(() => searchQuery = ''),
                    icon: Icon(
                      searchQuery.isEmpty ? Icons.search_rounded : Icons.close,
                      size: 20,
                    ),
                    tooltip: searchQuery.isEmpty ? 'Cari' : 'Hapus pencarian',
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: KeyedSubtree(key: ValueKey(section), child: pages[section]),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: section,
        height: 68,
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        onDestinationSelected: (value) => setState(() => section = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard_rounded),
            label: 'Ringkas',
          ),
          NavigationDestination(
            icon: Icon(Icons.swap_horiz_rounded),
            label: 'Uang',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_today_outlined),
            selectedIcon: Icon(Icons.calendar_month_rounded),
            label: 'Agenda',
          ),
          NavigationDestination(
            icon: Icon(Icons.note_alt_outlined),
            selectedIcon: Icon(Icons.note_alt_rounded),
            label: 'Catatan',
          ),
          NavigationDestination(
            icon: Icon(Icons.check_circle_outline),
            selectedIcon: Icon(Icons.check_circle),
            label: 'Habit',
          ),
          NavigationDestination(
            icon: Icon(Icons.view_kanban_outlined),
            selectedIcon: Icon(Icons.view_kanban_rounded),
            label: 'Proyek',
          ),
          NavigationDestination(
            icon: Icon(Icons.trending_up_rounded),
            label: 'Tumbuh',
          ),
        ],
      ),
      floatingActionButton: section == 0
          ? null
          : FloatingActionButton.extended(
              backgroundColor: ink,
              foregroundColor: Colors.white,
              onPressed: [
                null,
                () => addTransaction(),
                () => addAgenda(),
                () => addNote(),
                () => addHabit(),
                () => addTicket(),
                () => addGrowthGoal(),
              ][section],
              icon: const Icon(Icons.add_rounded),
              label: Text('Tambah ${titles[section].toLowerCase()}'),
            ),
    );
  }

  Widget page(List<Widget> children) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
    children: children,
  );

  JsonMap _lifeMap(String key) {
    final value = workspace.lifeOs[key];
    if (value is JsonMap) return value;
    final created = <String, dynamic>{};
    workspace.lifeOs[key] = created;
    return created;
  }

  List<dynamic> _lifeList(String key) {
    final value = workspace.lifeOs[key];
    if (value is List) return value;
    final created = <dynamic>[];
    workspace.lifeOs[key] = created;
    return created;
  }

  void startLifeCycle() {
    final today = DateTime.now();
    mutate(() {
      workspace.lifeOs['cycle'] = {
        'id': 'cycle-${dateKey(today)}',
        'name': 'Siklus 1',
        'startDate': dateKey(today),
        'endDate': dateKey(today.add(const Duration(days: 83))),
        'status': 'active',
        'copiedGoalIds': <String>[],
      };
    });
  }

  void completeLifeRitual(bool morning) {
    final today = dateKey(DateTime.now());
    mutate(() {
      final checkIns = _lifeList('checkIns');
      JsonMap? checkIn;
      for (final value in checkIns) {
        if (value is JsonMap && value['date'] == today) checkIn = value;
      }
      checkIn ??= <String, dynamic>{'id': 'checkin-$today', 'date': today};
      if (!checkIns.contains(checkIn)) checkIns.insert(0, checkIn);
      checkIn[morning ? 'morningCompletedAt' : 'eveningCompletedAt'] = DateTime.now().toUtc().toIso8601String();
      if (morning) checkIn['energy'] ??= 3;

      final gamification = _lifeMap('gamification');
      final awards = gamification['lastAwardKeys'] is List ? gamification['lastAwardKeys'] as List : <dynamic>[];
      gamification['lastAwardKeys'] = awards;
      final awardKey = '${morning ? 'morning' : 'evening'}:$today';
      if (!awards.contains(awardKey)) {
        awards.add(awardKey);
        gamification['totalXp'] = ((gamification['totalXp'] as num?)?.round() ?? 0) + 10;
      }
      gamification['ritualDays'] = checkIns.whereType<JsonMap>().where((item) => item['morningCompletedAt'] != null || item['eveningCompletedAt'] != null).map((item) => item['date']).whereType<String>().toSet().toList()..sort();
      gamification['perfectDays'] = checkIns.whereType<JsonMap>().where((item) => item['morningCompletedAt'] != null && item['eveningCompletedAt'] != null).map((item) => item['date']).whereType<String>().toSet().toList()..sort();
    });
  }

  Future<void> addLifePriority() async {
    final controller = TextEditingController();
    final title = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Prioritas hari ini'),
        content: TextField(controller: controller, autofocus: true, maxLength: 120, decoration: const InputDecoration(hintText: 'Satu hasil yang paling penting')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Batal')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Tambahkan')),
        ],
      ),
    );
    controller.dispose();
    if (title == null || title.isEmpty || !mounted) return;
    final today = dateKey(DateTime.now());
    final priorities = _lifeList('priorities');
    if (priorities.whereType<JsonMap>().where((item) => item['date'] == today).length >= 3) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Maksimal tiga prioritas per hari.')));
      return;
    }
    mutate(() => priorities.insert(0, {'id': newId(), 'date': today, 'text': title, 'done': false}));
  }

  void toggleLifePriority(String id, bool done) {
    mutate(() {
      for (final value in _lifeList('priorities')) {
        if (value is JsonMap && value['id'] == id) value['done'] = done;
      }
    });
  }

  Widget overview() {
    final today = DateTime.now();
    final agendaToday = workspace.agenda
        .where((item) => sameDay(item.date, today) && !item.isDone)
        .toList();
    final doneHabits = workspace.habits
        .where((item) => item.isDoneToday)
        .length;
    final latest = [...workspace.transactions]
      ..sort((a, b) => b.date.compareTo(a.date));
    GrowthGoal? activeGoal;
    for (final goal in workspace.growthGoals) {
      if (goal.progress < 100 && goal.nextAction.trim().isNotEmpty) {
        activeGoal = goal;
        break;
      }
    }
    HabitItem? pendingHabit;
    for (final habit in workspace.habits) {
      if (!habit.isDoneToday) {
        pendingHabit = habit;
        break;
      }
    }
    final mission =
        activeGoal?.nextAction ??
        (agendaToday.isNotEmpty ? agendaToday.first.title : null) ??
        pendingHabit?.name ??
        'Tulis kemenangan hari ini dan siapkan langkah kecil berikutnya.';
    final missionSection = activeGoal != null
        ? 6
        : agendaToday.isNotEmpty
        ? 2
        : pendingHabit != null
        ? 4
        : 6;
    final greeting = today.hour < 11
        ? 'Selamat pagi'
        : today.hour < 15
        ? 'Selamat siang'
        : today.hour < 19
        ? 'Selamat sore'
        : 'Selamat malam';
    final dayOfYear = today.difference(DateTime(today.year)).inDays + 1;
    final todayKey = dateKey(today);
    final cycle = workspace.lifeOs['cycle'] is JsonMap ? workspace.lifeOs['cycle'] as JsonMap : <String, dynamic>{};
    final checkIns = workspace.lifeOs['checkIns'] is List ? workspace.lifeOs['checkIns'] as List : <dynamic>[];
    JsonMap? todayCheckIn;
    for (final value in checkIns) {
      if (value is JsonMap && value['date'] == todayKey) todayCheckIn = value;
    }
    final priorities = (workspace.lifeOs['priorities'] is List ? workspace.lifeOs['priorities'] as List : <dynamic>[]).whereType<JsonMap>().where((item) => item['date'] == todayKey).take(3).toList();
    final gamification = workspace.lifeOs['gamification'] is JsonMap ? workspace.lifeOs['gamification'] as JsonMap : <String, dynamic>{};
    final xp = (gamification['totalXp'] as num?)?.round() ?? 0;
    return page([
      Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xff2f74f2), Color(0xff0b3d91)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(26),
          boxShadow: const [
            BoxShadow(
              color: Color(0x332563eb),
              blurRadius: 28,
              offset: Offset(0, 12),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '$greeting · ayo menangkan hari ini',
                  style: const TextStyle(
                    color: Color(0xffdcebff),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Icon(
                  Icons.auto_awesome_rounded,
                  color: Color(0xffdcebff),
                  size: 30,
                ),
              ],
            ),
            const SizedBox(height: 13),
            Text(
              dailyMessages[dayOfYear % dailyMessages.length],
              style: const TextStyle(
                color: Colors.white,
                fontSize: 25,
                height: 1.18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 15),
            Text(
              dateLabel(today),
              style: const TextStyle(color: Color(0xffdcebff)),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      Card(
        color: const Color(0xffeef5ff),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () => setState(() => section = missionSection),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: moss,
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: const Icon(
                    Icons.track_changes_rounded,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'MISI HARI INI',
                        style: TextStyle(
                          color: clay,
                          fontSize: 11,
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        mission,
                        style: const TextStyle(
                          color: ink,
                          fontSize: 16,
                          height: 1.3,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (activeGoal != null) ...[
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            value: activeGoal.progress / 100,
                            minHeight: 7,
                            backgroundColor: const Color(0xffdbeafe),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Icon(Icons.arrow_forward_rounded, color: moss),
                ),
              ],
            ),
          ),
        ),
      ),
      const SizedBox(height: 16),
      Card(
        color: const Color(0xffeef5ff),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('DAILY OS', style: TextStyle(color: clay, fontSize: 11, letterSpacing: 1.2, fontWeight: FontWeight.w800)),
              const SizedBox(height: 5),
              Text(cycle['status'] == 'active' ? '${cycle['name'] ?? 'Siklus'} · sampai ${cycle['endDate'] ?? '-'}' : 'Siklus 12 minggu belum dimulai', style: const TextStyle(color: ink, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Level ${1 + xp ~/ 250} · $xp XP', style: const TextStyle(color: Color(0xff66768d))),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (cycle['status'] != 'active') OutlinedButton.icon(onPressed: startLifeCycle, icon: const Icon(Icons.flag_outlined), label: const Text('Mulai siklus')),
                  FilledButton.tonalIcon(onPressed: todayCheckIn?['morningCompletedAt'] == null ? () => completeLifeRitual(true) : null, icon: const Icon(Icons.wb_sunny_outlined), label: Text(todayCheckIn?['morningCompletedAt'] == null ? 'Ritual pagi' : 'Pagi selesai')),
                  FilledButton.tonalIcon(onPressed: todayCheckIn?['eveningCompletedAt'] == null ? () => completeLifeRitual(false) : null, icon: const Icon(Icons.nightlight_outlined), label: Text(todayCheckIn?['eveningCompletedAt'] == null ? 'Ritual malam' : 'Malam selesai')),
                ],
              ),
              const Divider(height: 28),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('3 prioritas hari ini', style: TextStyle(color: ink, fontWeight: FontWeight.w800)), IconButton(onPressed: priorities.length < 3 ? addLifePriority : null, icon: const Icon(Icons.add_circle_outline), tooltip: 'Tambah prioritas')]),
              if (priorities.isEmpty)
                const Text('Pilih hingga tiga hasil penting agar harimu terarah.', style: TextStyle(color: Color(0xff66768d)))
              else
                ...priorities.map((item) => CheckboxListTile(contentPadding: EdgeInsets.zero, dense: true, value: item['done'] == true, title: Text(item['text'] as String? ?? 'Prioritas'), onChanged: (value) => toggleLifePriority(item['id'] as String? ?? '', value == true))),
            ],
          ),
        ),
      ),
      const SizedBox(height: 16),
      LayoutBuilder(
        builder: (context, constraints) {
          final width = (constraints.maxWidth - 12) / 2;
          return Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              StatCard(
                width: width,
                label: 'SALDO BERSIH',
                value: displayMoney(workspace.balance),
                icon: Icons.account_balance_wallet_outlined,
                color: moss,
              ),
              StatCard(
                width: width,
                label: 'KELUAR BULAN INI',
                value: displayMoney(workspace.monthExpenses),
                icon: Icons.trending_down_rounded,
                color: danger,
              ),
              StatCard(
                width: width,
                label: 'AGENDA HARI INI',
                value: '${agendaToday.length} kegiatan',
                icon: Icons.calendar_today_outlined,
                color: ink,
              ),
              StatCard(
                width: width,
                label: 'HABIT SELESAI',
                value: '$doneHabits/${workspace.habits.length}',
                icon: Icons.task_alt_rounded,
                color: moss,
              ),
            ],
          );
        },
      ),
      const SizedBox(height: 22),
      const SectionTitle(
        title: 'Transaksi terbaru',
        subtitle: 'Aktivitas keuangan terakhir',
      ),
      const SizedBox(height: 10),
      if (latest.isEmpty)
        const EmptyCard(text: 'Belum ada transaksi.')
      else
        ...latest.take(4).map(transactionTile),
      const SizedBox(height: 18),
      const SectionTitle(
        title: 'Fokus hari ini',
        subtitle: 'Agenda yang belum selesai',
      ),
      const SizedBox(height: 10),
      if (agendaToday.isEmpty)
        const EmptyCard(text: 'Tidak ada agenda tertunda hari ini.')
      else
        ...agendaToday.map(agendaTile),
    ]);
  }

  Widget transactions() {
    final rows =
        workspace.transactions.where((item) => matches(item.title)).toList()
          ..sort((a, b) => b.date.compareTo(a.date));
    return page([
      TotalsCard(
        income: workspace.transactions
            .where((item) => item.isIncome)
            .fold(0, (sum, item) => sum + item.amount),
        expense: workspace.transactions
            .where((item) => !item.isIncome)
            .fold(0, (sum, item) => sum + item.amount),
        hideBalances: workspace.settings.hideBalances,
      ),
      if (workspace.settings.monthlyBudget > 0) ...[
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Anggaran bulan ini · ${displayMoney(workspace.monthExpenses)} / ${displayMoney(workspace.settings.monthlyBudget)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: ink,
                  ),
                ),
                const SizedBox(height: 10),
                LinearProgressIndicator(
                  value:
                      (workspace.monthExpenses /
                              workspace.settings.monthlyBudget)
                          .clamp(0, 1),
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(8),
                  color:
                      workspace.monthExpenses >=
                          workspace.settings.monthlyBudget
                      ? danger
                      : moss,
                  backgroundColor: const Color(0xffe9f2ff),
                ),
              ],
            ),
          ),
        ),
      ],
      const SizedBox(height: 18),
      if (rows.isEmpty)
        const EmptyCard(
          text: 'Belum ada transaksi. Tekan tombol tambah untuk mencoba.',
        )
      else
        ...rows.map(transactionTile),
    ]);
  }

  Widget transactionTile(TransactionItem item) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      leading: CircleAvatar(
        backgroundColor: item.isIncome
            ? const Color(0xffe9f2ff)
            : const Color(0xfffff0f3),
        foregroundColor: item.isIncome ? moss : danger,
        child: Icon(
          item.isIncome ? Icons.south_west_rounded : Icons.north_east_rounded,
        ),
      ),
      title: Text(
        item.title,
        style: const TextStyle(fontWeight: FontWeight.w700, color: ink),
      ),
      subtitle: Text(shortDate(item.date)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            workspace.settings.hideBalances
                ? '••••••'
                : '${item.isIncome ? '+' : '−'}${money(item.amount)}',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: item.isIncome ? moss : danger,
            ),
          ),
          IconButton(
            onPressed: () => addTransaction(item),
            icon: const Icon(Icons.edit_outlined, size: 20),
            tooltip: 'Ubah',
          ),
          IconButton(
            onPressed: () => mutate(
              () => workspace.transactions.removeWhere(
                (row) => row.id == item.id,
              ),
            ),
            icon: const Icon(Icons.delete_outline_rounded, size: 20),
            tooltip: 'Hapus',
          ),
        ],
      ),
    ),
  );

  Widget agenda() {
    final rows = workspace.agenda.where((item) => matches(item.title)).toList()
      ..sort((a, b) => a.date.compareTo(b.date));
    return page([
      if (rows.isEmpty)
        const EmptyCard(
          text: 'Belum ada agenda. Tekan tombol tambah untuk mencoba.',
        )
      else
        ...rows.map(agendaTile),
    ]);
  }

  Widget agendaTile(AgendaItem item) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      onTap: () => mutate(() {
        final index = workspace.agenda.indexOf(item);
        workspace.agenda[index] = item.copyWith(isDone: !item.isDone);
      }),
      leading: Icon(
        item.isDone
            ? Icons.check_circle_rounded
            : Icons.radio_button_unchecked_rounded,
        color: item.isDone ? moss : const Color(0xff8291a6),
        size: 28,
      ),
      title: Text(
        item.title,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: ink,
          decoration: item.isDone ? TextDecoration.lineThrough : null,
        ),
      ),
      subtitle: Text(dateLabel(item.date)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            onPressed: () => addAgenda(item),
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Ubah',
          ),
          IconButton(
            onPressed: () => mutate(
              () => workspace.agenda.removeWhere((row) => row.id == item.id),
            ),
            icon: const Icon(Icons.delete_outline_rounded),
            tooltip: 'Hapus',
          ),
        ],
      ),
    ),
  );

  Widget notes() {
    final rows =
        workspace.notes
            .where((item) => matches('${item.title} ${item.body}'))
            .toList()
          ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return page([
      if (rows.isEmpty)
        const EmptyCard(
          text: 'Belum ada catatan. Tekan tombol tambah untuk mencoba.',
        )
      else
        ...rows.map(
          (item) => Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 17, 10, 13),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: ink,
                          ),
                        ),
                        if (item.body.isNotEmpty) ...[
                          const SizedBox(height: 7),
                          Text(
                            item.body,
                            style: const TextStyle(
                              height: 1.45,
                              color: Color(0xff52647c),
                            ),
                          ),
                        ],
                        const SizedBox(height: 10),
                        Text(
                          'Diperbarui ${shortDate(item.updatedAt)}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xff6981a4),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => addNote(item),
                    icon: const Icon(Icons.edit_outlined),
                    tooltip: 'Ubah',
                  ),
                  IconButton(
                    onPressed: () => mutate(
                      () => workspace.notes.removeWhere(
                        (row) => row.id == item.id,
                      ),
                    ),
                    icon: const Icon(Icons.delete_outline_rounded),
                    tooltip: 'Hapus',
                  ),
                ],
              ),
            ),
          ),
        ),
    ]);
  }

  Widget habits() {
    final completed = workspace.habits.where((item) => item.isDoneToday).length;
    return page([
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: moss,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 58,
              height: 58,
              child: CircularProgressIndicator(
                value: workspace.habits.isEmpty
                    ? 0
                    : completed / workspace.habits.length,
                strokeWidth: 7,
                backgroundColor: Colors.white24,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$completed dari ${workspace.habits.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 3),
                  const Text(
                    'kebiasaan selesai hari ini',
                    style: TextStyle(color: Color(0xffdcebff)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      if (workspace.habits.isEmpty)
        const EmptyCard(
          text: 'Belum ada kebiasaan. Tekan tombol tambah untuk mencoba.',
        )
      else
        ...workspace.habits
            .where((item) => matches(item.name))
            .map(
              (item) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 6,
                  ),
                  onTap: () => mutate(() {
                    final index = workspace.habits.indexOf(item);
                    workspace.habits[index] = item.toggle(DateTime.now());
                  }),
                  leading: Icon(
                    item.isDoneToday
                        ? Icons.check_circle_rounded
                        : Icons.circle_outlined,
                    color: item.isDoneToday ? moss : const Color(0xff8291a6),
                    size: 30,
                  ),
                  title: Text(
                    item.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: ink,
                    ),
                  ),
                  subtitle: Text(
                    item.isDoneToday ? 'Selesai hari ini' : 'Belum dilakukan',
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (item.currentStreak > 0)
                        Text(
                          '${item.currentStreak} hari',
                          style: const TextStyle(
                            color: moss,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      IconButton(
                        onPressed: () => addHabit(item),
                        icon: const Icon(Icons.edit_outlined),
                        tooltip: 'Ubah',
                      ),
                      IconButton(
                        onPressed: () => mutate(
                          () => workspace.habits.removeWhere(
                            (row) => row.id == item.id,
                          ),
                        ),
                        icon: const Icon(Icons.delete_outline_rounded),
                        tooltip: 'Hapus',
                      ),
                    ],
                  ),
                ),
              ),
            ),
    ]);
  }

  Widget projects() {
    final activeProjects =
        workspace.projects.where((item) => !item.archived).toList()
          ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    if (activeProjects.every((item) => item.id != selectedProjectId)) {
      selectedProjectId = activeProjects.isEmpty ? '' : activeProjects.first.id;
    }
    ProjectBoard? project;
    for (final item in activeProjects) {
      if (item.id == selectedProjectId) project = item;
    }
    final tickets =
        workspace.tickets
            .where(
              (item) =>
                  item.projectId == selectedProjectId &&
                  (showArchivedTickets || !item.archived) &&
                  matches(
                    '${item.title} ${item.description} ${item.labels.join(' ')}',
                  ),
            )
            .toList()
          ..sort((a, b) => a.order.compareTo(b.order));
    final done = tickets.where((item) => item.status == 'done').length;
    final urgent = tickets.where((item) => item.priority == 'urgent').length;
    final dueSoon = tickets.where((item) {
      final due = DateTime.tryParse(item.dueDate);
      return due != null &&
          due.difference(DateTime.now()).inDays <= 7 &&
          item.status != 'done';
    }).length;

    return page([
      Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xff2563eb), Color(0xff172554)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(26),
          boxShadow: const [
            BoxShadow(
              color: Color(0x332563eb),
              blurRadius: 25,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'PROYEK & TICKET',
                    style: TextStyle(
                      color: Color(0xffbfdbfe),
                      fontSize: 10,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    project?.name ?? 'Mulai proyek pertamamu',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      height: 1.15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    project?.description.isNotEmpty == true
                        ? project!.description
                        : 'Ubah rencana menjadi ticket yang bergerak sampai selesai.',
                    style: const TextStyle(
                      color: Color(0xffdbeafe),
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            const Icon(
              Icons.view_kanban_rounded,
              color: Color(0xffbfdbfe),
              size: 48,
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: selectedProjectId.isEmpty
                          ? null
                          : selectedProjectId,
                      decoration: const InputDecoration(
                        labelText: 'Board proyek',
                      ),
                      items: activeProjects
                          .map(
                            (item) => DropdownMenuItem(
                              value: item.id,
                              child: Text(item.name),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setState(() => selectedProjectId = value ?? ''),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    onPressed: addProject,
                    icon: const Icon(Icons.create_new_folder_outlined),
                    tooltip: 'Buat proyek',
                  ),
                  IconButton(
                    onPressed: project == null
                        ? null
                        : () => mutate(() {
                            final index = workspace.projects.indexWhere(
                              (item) => item.id == project!.id,
                            );
                            workspace.projects[index] = project!.copyWith(
                              archived: true,
                            );
                            selectedProjectId = '';
                          }),
                    icon: const Icon(Icons.archive_outlined),
                    tooltip: 'Arsipkan proyek',
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _projectMetric(
                      'TICKET',
                      '${tickets.length}',
                      Icons.confirmation_number_outlined,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _projectMetric(
                      'SELESAI',
                      '$done',
                      Icons.task_alt_rounded,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _projectMetric(
                      'MENDESAK',
                      '$urgent',
                      Icons.bolt_rounded,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _projectMetric(
                      'DEKAT',
                      '$dueSoon',
                      Icons.event_outlined,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: FilterChip(
                  selected: showArchivedTickets,
                  onSelected: (value) =>
                      setState(() => showArchivedTickets = value),
                  avatar: const Icon(Icons.inventory_2_outlined, size: 17),
                  label: const Text('Tampilkan arsip ticket'),
                ),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 12),
      if (project == null)
        Card(
          color: const Color(0xffeef5ff),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              children: [
                const Icon(Icons.rocket_launch_outlined, color: moss, size: 38),
                const SizedBox(height: 10),
                const Text(
                  'Buat proyek agar ide punya jalur menuju selesai.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ink, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: addProject,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Buat proyek pertama'),
                ),
              ],
            ),
          ),
        )
      else
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: kanbanStatuses
                .map(
                  (status) => Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: _kanbanColumn(
                      status,
                      tickets.where((item) => item.status == status).toList(),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
    ]);
  }

  Widget _projectMetric(String label, String value, IconData icon) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
    decoration: BoxDecoration(
      color: const Color(0xffeef5ff),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      children: [
        Icon(icon, color: moss, size: 18),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: ink,
            fontSize: 17,
            fontWeight: FontWeight.w900,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xff66768d),
            fontSize: 8,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );

  Widget _kanbanColumn(String status, List<KanbanTicket> tickets) {
    final columnColor = switch (status) {
      'ready' => const Color(0xffeaf5ff),
      'in_progress' => const Color(0xffe7f0ff),
      'review' => const Color(0xfff1ecff),
      'done' => const Color(0xffeaf8f1),
      _ => const Color(0xffeef3fa),
    };
    return Container(
      width: 275,
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: columnColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(3, 3, 3, 10),
            child: Row(
              children: [
                Container(
                  width: 9,
                  height: 9,
                  decoration: const BoxDecoration(
                    color: moss,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    kanbanStatusLabel(status),
                    style: const TextStyle(
                      color: ink,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                Badge(
                  label: Text('${tickets.length}'),
                  backgroundColor: Colors.white,
                  textColor: ink,
                ),
              ],
            ),
          ),
          if (tickets.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white54,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text(
                'Belum ada ticket',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xff8291a6), fontSize: 12),
              ),
            )
          else
            ...tickets.map(_ticketCard),
        ],
      ),
    );
  }

  Widget _ticketCard(KanbanTicket ticket) {
    final statusIndex = kanbanStatuses.indexOf(ticket.status);
    final completed = ticket.checklist.where((item) => item.done).length;
    final priorityColor = switch (ticket.priority) {
      'urgent' => const Color(0xffdc2626),
      'high' => const Color(0xffea580c),
      'low' => const Color(0xff64748b),
      _ => const Color(0xff2563eb),
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 9),
      color: ticket.archived ? const Color(0xfff1f5f9) : Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => showTicketDetails(ticket.id),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      ticket.title,
                      style: const TextStyle(
                        color: ink,
                        fontWeight: FontWeight.w800,
                        height: 1.25,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    ticketPriorityLabel(ticket.priority),
                    style: TextStyle(
                      color: priorityColor,
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              if (ticket.labels.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 5,
                  runSpacing: 5,
                  children: ticket.labels
                      .take(3)
                      .map(
                        (label) => Chip(
                          visualDensity: VisualDensity.compact,
                          label: Text(
                            label,
                            style: const TextStyle(fontSize: 10),
                          ),
                          padding: EdgeInsets.zero,
                        ),
                      )
                      .toList(),
                ),
              ],
              const SizedBox(height: 8),
              Text(
                '${ticket.dueDate.isEmpty ? 'Tanpa tenggat' : ticket.dueDate} · $completed/${ticket.checklist.length} checklist · ${ticket.comments.length} komentar',
                style: const TextStyle(color: Color(0xff66768d), fontSize: 10),
              ),
              const SizedBox(height: 9),
              Row(
                children: [
                  IconButton.outlined(
                    visualDensity: VisualDensity.compact,
                    onPressed: statusIndex <= 0 || ticket.archived
                        ? null
                        : () => moveTicket(ticket, -1),
                    icon: const Icon(Icons.arrow_back_rounded, size: 17),
                    tooltip: 'Ke kiri',
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => showTicketDetails(ticket.id),
                    child: const Text('Detail'),
                  ),
                  const Spacer(),
                  IconButton.outlined(
                    visualDensity: VisualDensity.compact,
                    onPressed:
                        statusIndex >= kanbanStatuses.length - 1 ||
                            ticket.archived
                        ? null
                        : () => moveTicket(ticket, 1),
                    icon: const Icon(Icons.arrow_forward_rounded, size: 17),
                    tooltip: 'Ke kanan',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void moveTicket(KanbanTicket ticket, int direction) {
    final current = kanbanStatuses.indexOf(ticket.status);
    final next = (current + direction).clamp(0, kanbanStatuses.length - 1);
    if (next == current) return;
    mutate(() {
      final index = workspace.tickets.indexWhere(
        (item) => item.id == ticket.id,
      );
      workspace.tickets[index] = ticket.copyWith(
        status: kanbanStatuses[next],
        updatedAt: DateTime.now(),
      );
    });
  }

  Widget growth() {
    final metrics = GrowthMetrics.calculate(
      workspace.growthGoals,
      workspace.focusSessions,
      workspace.dailyReviews,
    );
    final goals =
        workspace.growthGoals
            .where((item) => matches('${item.title} ${item.nextAction}'))
            .toList()
          ..sort((a, b) => a.progress.compareTo(b.progress));
    final sessions =
        workspace.focusSessions
            .where((item) => matches('${item.title} ${item.note}'))
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));
    final reviews = [...workspace.dailyReviews]
      ..sort((a, b) => b.date.compareTo(a.date));
    return page([
      Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xff2563eb), Color(0xff312e81)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(26),
        ),
        child: Row(
          children: [
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'PUSAT PERKEMBANGAN',
                    style: TextStyle(
                      color: Color(0xffdbeafe),
                      fontSize: 10,
                      letterSpacing: 1,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 7),
                  Text(
                    'Tumbuh dengan bukti, bukan sekadar niat.',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      height: 1.15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Container(
              width: 82,
              height: 82,
              decoration: BoxDecoration(
                color: Colors.white12,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white24, width: 7),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${metrics.growthScore}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const Text(
                    'SKOR',
                    style: TextStyle(
                      color: Color(0xffdbeafe),
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          ActionChip(
            avatar: const Icon(Icons.flag_outlined, size: 17),
            label: const Text('Tujuan'),
            onPressed: () => addGrowthGoal(),
          ),
          ActionChip(
            avatar: const Icon(Icons.timer_outlined, size: 17),
            label: const Text('Catat fokus'),
            onPressed: addFocusSession,
          ),
          ActionChip(
            avatar: const Icon(Icons.psychology_outlined, size: 17),
            label: const Text('Refleksi'),
            onPressed: () => addDailyReview(),
          ),
        ],
      ),
      const SizedBox(height: 12),
      LayoutBuilder(
        builder: (context, constraints) {
          final width = (constraints.maxWidth - 12) / 2;
          return Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              StatCard(
                width: width,
                label: 'TUJUAN AKTIF',
                value: '${metrics.activeGoals}',
                icon: Icons.flag_outlined,
                color: ink,
              ),
              StatCard(
                width: width,
                label: 'PROGRES RATA-RATA',
                value: '${metrics.averageProgress}%',
                icon: Icons.trending_up_rounded,
                color: moss,
              ),
              StatCard(
                width: width,
                label: 'FOKUS 7 HARI',
                value: '${metrics.weeklyMinutes} menit',
                icon: Icons.timer_outlined,
                color: clay,
              ),
              StatCard(
                width: width,
                label: 'STREAK REFLEKSI',
                value: '${metrics.reviewStreak} hari',
                icon: Icons.auto_awesome_rounded,
                color: moss,
              ),
            ],
          );
        },
      ),
      const SizedBox(height: 22),
      const SectionTitle(
        title: 'Tujuan perkembangan',
        subtitle: 'Naikkan progres sedikit demi sedikit',
      ),
      const SizedBox(height: 10),
      if (goals.isEmpty)
        const EmptyCard(text: 'Belum ada tujuan perkembangan.')
      else
        ...goals.map(
          (goal) => Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xffe9f2ff),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          growthAreaLabel(goal.area),
                          style: const TextStyle(
                            color: moss,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () => addGrowthGoal(goal),
                        icon: const Icon(Icons.edit_outlined),
                        tooltip: 'Ubah',
                      ),
                      IconButton(
                        onPressed: () => mutate(
                          () => workspace.growthGoals.removeWhere(
                            (item) => item.id == goal.id,
                          ),
                        ),
                        icon: const Icon(Icons.delete_outline_rounded),
                        tooltip: 'Hapus',
                      ),
                    ],
                  ),
                  Text(
                    goal.title,
                    style: const TextStyle(
                      color: ink,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 7),
                  LinearProgressIndicator(
                    value: goal.progress / 100,
                    minHeight: 8,
                    borderRadius: BorderRadius.circular(8),
                    color: goal.isComplete ? moss : clay,
                    backgroundColor: const Color(0xffe9f2ff),
                  ),
                  const SizedBox(height: 7),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          goal.isComplete
                              ? 'Selesai'
                              : goal.nextAction.isEmpty
                              ? 'Tentukan langkah berikutnya'
                              : goal.nextAction,
                          style: const TextStyle(
                            color: Color(0xff66768d),
                            fontSize: 12,
                          ),
                        ),
                      ),
                      Text(
                        '${goal.progress}%',
                        style: const TextStyle(
                          color: moss,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      OutlinedButton(
                        onPressed: goal.progress >= 100
                            ? null
                            : () => mutate(() {
                                final index = workspace.growthGoals.indexOf(
                                  goal,
                                );
                                workspace.growthGoals[index] = goal.copyWith(
                                  progress: goal.progress + 10,
                                );
                              }),
                        child: const Text('+10%'),
                      ),
                      OutlinedButton(
                        onPressed: goal.progress >= 100
                            ? null
                            : () => mutate(() {
                                final index = workspace.growthGoals.indexOf(
                                  goal,
                                );
                                workspace.growthGoals[index] = goal.copyWith(
                                  progress: 100,
                                );
                              }),
                        child: const Text('Selesai'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      const SizedBox(height: 18),
      const SectionTitle(
        title: 'Pencapaian',
        subtitle: 'Terbuka otomatis dari progres nyata',
      ),
      const SizedBox(height: 8),
      if (metrics.achievements.isEmpty)
        const EmptyCard(text: 'Mulai satu tujuan untuk membuka pencapaian.')
      else
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: metrics.achievements
              .map(
                (item) => Chip(
                  avatar: const Icon(
                    Icons.emoji_events_outlined,
                    size: 17,
                    color: Color(0xffa16207),
                  ),
                  label: Text(item),
                  backgroundColor: const Color(0xfffff7d6),
                ),
              )
              .toList(),
        ),
      const SizedBox(height: 22),
      const SectionTitle(
        title: 'Fokus dan belajar',
        subtitle: 'Sesi terbaru dalam semua area',
      ),
      const SizedBox(height: 10),
      if (sessions.isEmpty)
        const EmptyCard(text: 'Belum ada sesi fokus.')
      else
        ...sessions
            .take(6)
            .map(
              (item) => Card(
                margin: const EdgeInsets.only(bottom: 9),
                child: ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xffe9f2ff),
                    foregroundColor: moss,
                    child: Icon(Icons.timer_outlined),
                  ),
                  title: Text(
                    item.title,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    '${growthAreaLabel(item.area)} · ${item.minutes} menit · ${shortDate(item.date)}${item.note.isEmpty ? '' : '\n${item.note}'}',
                  ),
                  isThreeLine: item.note.isNotEmpty,
                  trailing: IconButton(
                    onPressed: () => mutate(
                      () => workspace.focusSessions.removeWhere(
                        (row) => row.id == item.id,
                      ),
                    ),
                    icon: const Icon(Icons.delete_outline_rounded),
                    tooltip: 'Hapus',
                  ),
                ),
              ),
            ),
      const SizedBox(height: 18),
      const SectionTitle(
        title: 'Refleksi terbaru',
        subtitle: 'Kemenangan, pelajaran, dan langkah berikutnya',
      ),
      const SizedBox(height: 10),
      if (reviews.isEmpty)
        const EmptyCard(text: 'Belum ada refleksi harian.')
      else
        ...reviews
            .take(5)
            .map(
              (review) => Card(
                margin: const EdgeInsets.only(bottom: 9),
                child: ListTile(
                  onTap: () => addDailyReview(review),
                  title: Text(
                    '${shortDate(review.date)} · Mood ${review.mood}/5 · Energi ${review.energy}/5',
                    style: const TextStyle(
                      color: moss,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: Text(
                    [
                      if (review.win.isNotEmpty) 'Menang: ${review.win}',
                      if (review.lesson.isNotEmpty)
                        'Pelajaran: ${review.lesson}',
                      if (review.nextStep.isNotEmpty)
                        'Berikutnya: ${review.nextStep}',
                    ].join('\n'),
                  ),
                  trailing: IconButton(
                    onPressed: () => mutate(
                      () => workspace.dailyReviews.removeWhere(
                        (row) => row.id == review.id,
                      ),
                    ),
                    icon: const Icon(Icons.delete_outline_rounded),
                    tooltip: 'Hapus',
                  ),
                ),
              ),
            ),
    ]);
  }

  Future<void> addProject() async {
    final name = TextEditingController();
    final description = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Proyek baru'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Nama proyek'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: description,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Tujuan singkat proyek',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton.icon(
            onPressed: () {
              if (name.text.trim().isEmpty) return;
              final project = ProjectBoard(
                id: newId(),
                name: name.text.trim(),
                description: description.text.trim(),
                color: '#2563EB',
                archived: false,
                createdAt: DateTime.now(),
              );
              mutate(() {
                workspace.projects.add(project);
                selectedProjectId = project.id;
              });
              Navigator.pop(context);
            },
            icon: const Icon(Icons.rocket_launch_outlined),
            label: const Text('Buat proyek'),
          ),
        ],
      ),
    );
    name.dispose();
    description.dispose();
  }

  Future<void> addTicket([KanbanTicket? existing]) async {
    if (selectedProjectId.isEmpty ||
        workspace.projects.every(
          (item) => item.id != selectedProjectId || item.archived,
        )) {
      await addProject();
      if (!mounted || selectedProjectId.isEmpty) return;
    }
    final title = TextEditingController(text: existing?.title);
    final description = TextEditingController(text: existing?.description);
    final labels = TextEditingController(text: existing?.labels.join(', '));
    var status = existing?.status ?? 'backlog';
    var priority = existing?.priority ?? 'medium';
    DateTime? dueDate = existing?.dueDate.isNotEmpty == true
        ? DateTime.tryParse(existing!.dueDate)
        : null;
    String? linkedAgendaId = existing?.linkedScheduleId;
    String? linkedGrowthId = existing?.linkedGrowthGoalId;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(existing == null ? 'Ticket baru' : 'Ubah ticket'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: title,
                  autofocus: true,
                  decoration: const InputDecoration(labelText: 'Judul ticket'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: description,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Deskripsi'),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: status,
                        decoration: const InputDecoration(labelText: 'Status'),
                        items: kanbanStatuses
                            .map(
                              (value) => DropdownMenuItem(
                                value: value,
                                child: Text(kanbanStatusLabel(value)),
                              ),
                            )
                            .toList(),
                        onChanged: (value) =>
                            setDialogState(() => status = value ?? 'backlog'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: priority,
                        decoration: const InputDecoration(
                          labelText: 'Prioritas',
                        ),
                        items: ticketPriorities
                            .map(
                              (value) => DropdownMenuItem(
                                value: value,
                                child: Text(ticketPriorityLabel(value)),
                              ),
                            )
                            .toList(),
                        onChanged: (value) =>
                            setDialogState(() => priority = value ?? 'medium'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: labels,
                  decoration: const InputDecoration(
                    labelText: 'Label, pisahkan koma',
                  ),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: Text(
                    dueDate == null ? 'Tanpa tenggat' : dateLabel(dueDate!),
                  ),
                  trailing: dueDate == null
                      ? null
                      : IconButton(
                          onPressed: () => setDialogState(() => dueDate = null),
                          icon: const Icon(Icons.close_rounded),
                        ),
                  onTap: () async {
                    final value = await showDatePicker(
                      context: context,
                      firstDate: DateTime.now().subtract(
                        const Duration(days: 3650),
                      ),
                      lastDate: DateTime.now().add(const Duration(days: 3650)),
                      initialDate: dueDate ?? DateTime.now(),
                    );
                    if (value != null) setDialogState(() => dueDate = value);
                  },
                ),
                DropdownButtonFormField<String?>(
                  initialValue: linkedAgendaId,
                  decoration: const InputDecoration(
                    labelText: 'Hubungkan agenda',
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Tanpa agenda'),
                    ),
                    ...workspace.agenda.map(
                      (item) => DropdownMenuItem<String?>(
                        value: item.id,
                        child: Text(item.title),
                      ),
                    ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => linkedAgendaId = value),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String?>(
                  initialValue: linkedGrowthId,
                  decoration: const InputDecoration(
                    labelText: 'Hubungkan tujuan perkembangan',
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Tanpa tujuan'),
                    ),
                    ...workspace.growthGoals.map(
                      (item) => DropdownMenuItem<String?>(
                        value: item.id,
                        child: Text(item.title),
                      ),
                    ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => linkedGrowthId = value),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () {
                if (title.text.trim().isEmpty) return;
                final now = DateTime.now();
                final labelValues = labels.text
                    .split(',')
                    .map((item) => item.trim())
                    .where((item) => item.isNotEmpty)
                    .toSet()
                    .take(10)
                    .toList();
                final ticket = KanbanTicket(
                  id: existing?.id ?? newId(),
                  projectId: existing?.projectId ?? selectedProjectId,
                  title: title.text.trim(),
                  description: description.text.trim(),
                  status: status,
                  priority: priority,
                  labels: labelValues,
                  dueDate: dueDate == null ? '' : dateKey(dueDate!),
                  checklist: existing?.checklist ?? const [],
                  comments: existing?.comments ?? const [],
                  linkedScheduleId: linkedAgendaId,
                  linkedGrowthGoalId: linkedGrowthId,
                  archived: existing?.archived ?? false,
                  order: existing?.order ?? now.microsecondsSinceEpoch,
                  createdAt: existing?.createdAt ?? now,
                  updatedAt: now,
                );
                mutate(() {
                  final index = workspace.tickets.indexWhere(
                    (item) => item.id == ticket.id,
                  );
                  if (index >= 0) {
                    workspace.tickets[index] = ticket;
                  } else {
                    workspace.tickets.add(ticket);
                  }
                });
                Navigator.pop(context);
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    title.dispose();
    description.dispose();
    labels.dispose();
  }

  Future<void> showTicketDetails(String ticketId) async {
    final checklistInput = TextEditingController();
    final commentInput = TextEditingController();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final index = workspace.tickets.indexWhere(
            (item) => item.id == ticketId,
          );
          if (index < 0) return const SizedBox.shrink();
          final ticket = workspace.tickets[index];
          AgendaItem? linkedAgenda;
          GrowthGoal? linkedGoal;
          for (final item in workspace.agenda) {
            if (item.id == ticket.linkedScheduleId) linkedAgenda = item;
          }
          for (final item in workspace.growthGoals) {
            if (item.id == ticket.linkedGrowthGoalId) linkedGoal = item;
          }
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                18,
                0,
                18,
                MediaQuery.viewInsetsOf(context).bottom + 18,
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            ticket.title,
                            style: const TextStyle(
                              color: ink,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        PopupMenuButton<String>(
                          onSelected: (value) {
                            if (value == 'edit') {
                              Navigator.pop(context);
                              unawaited(addTicket(ticket));
                            }
                            if (value == 'archive') {
                              mutate(
                                () =>
                                    workspace.tickets[index] = ticket.copyWith(
                                      archived: !ticket.archived,
                                      updatedAt: DateTime.now(),
                                    ),
                              );
                              Navigator.pop(context);
                            }
                            if (value == 'delete') {
                              mutate(() => workspace.tickets.removeAt(index));
                              Navigator.pop(context);
                            }
                          },
                          itemBuilder: (_) => [
                            const PopupMenuItem(
                              value: 'edit',
                              child: Text('Ubah ticket'),
                            ),
                            PopupMenuItem(
                              value: 'archive',
                              child: Text(
                                ticket.archived
                                    ? 'Pulihkan dari arsip'
                                    : 'Arsipkan ticket',
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'delete',
                              child: Text('Hapus ticket'),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 7,
                      runSpacing: 7,
                      children: [
                        Chip(
                          label: Text(kanbanStatusLabel(ticket.status)),
                          avatar: const Icon(
                            Icons.circle,
                            size: 11,
                            color: moss,
                          ),
                        ),
                        Chip(
                          label: Text(ticketPriorityLabel(ticket.priority)),
                          avatar: const Icon(Icons.bolt_rounded, size: 16),
                        ),
                        ...ticket.labels.map(
                          (label) => Chip(label: Text(label)),
                        ),
                      ],
                    ),
                    if (ticket.description.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text(
                        ticket.description,
                        style: const TextStyle(
                          color: Color(0xff52647c),
                          height: 1.45,
                        ),
                      ),
                    ],
                    if (ticket.dueDate.isNotEmpty ||
                        linkedAgenda != null ||
                        linkedGoal != null) ...[
                      const SizedBox(height: 12),
                      Card(
                        color: const Color(0xffeef5ff),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (ticket.dueDate.isNotEmpty)
                                Text('Tenggat · ${ticket.dueDate}'),
                              if (linkedAgenda != null)
                                Text('Agenda · ${linkedAgenda.title}'),
                              if (linkedGoal != null)
                                Text('Tujuan · ${linkedGoal.title}'),
                            ],
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    const Text(
                      'Checklist',
                      style: TextStyle(
                        color: ink,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: checklistInput,
                            decoration: const InputDecoration(
                              hintText: 'Langkah kecil berikutnya',
                            ),
                          ),
                        ),
                        const SizedBox(width: 7),
                        IconButton.filled(
                          onPressed: () {
                            final text = checklistInput.text.trim();
                            if (text.isEmpty) return;
                            mutate(() {
                              workspace.tickets[index] = ticket.copyWith(
                                checklist: [
                                  ...ticket.checklist,
                                  TicketChecklistItem(
                                    id: newId(),
                                    text: text,
                                    done: false,
                                  ),
                                ],
                                updatedAt: DateTime.now(),
                              );
                            });
                            checklistInput.clear();
                            setSheetState(() {});
                          },
                          icon: const Icon(Icons.add_rounded),
                        ),
                      ],
                    ),
                    ...ticket.checklist.map(
                      (item) => CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        value: item.done,
                        title: Text(item.text),
                        onChanged: (_) {
                          mutate(() {
                            workspace.tickets[index] = ticket.copyWith(
                              checklist: ticket.checklist
                                  .map(
                                    (row) => row.id == item.id
                                        ? row.copyWith(done: !row.done)
                                        : row,
                                  )
                                  .toList(),
                              updatedAt: DateTime.now(),
                            );
                          });
                          setSheetState(() {});
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Komentar',
                      style: TextStyle(
                        color: ink,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: commentInput,
                            decoration: const InputDecoration(
                              hintText: 'Catat progres atau keputusan',
                            ),
                          ),
                        ),
                        const SizedBox(width: 7),
                        IconButton.filled(
                          onPressed: () {
                            final body = commentInput.text.trim();
                            if (body.isEmpty) return;
                            mutate(() {
                              workspace.tickets[index] = ticket.copyWith(
                                comments: [
                                  ...ticket.comments,
                                  TicketComment(
                                    id: newId(),
                                    body: body,
                                    createdAt: DateTime.now(),
                                  ),
                                ],
                                updatedAt: DateTime.now(),
                              );
                            });
                            commentInput.clear();
                            setSheetState(() {});
                          },
                          icon: const Icon(Icons.send_rounded),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ...ticket.comments.reversed.map(
                      (comment) => Card(
                        color: const Color(0xfff3f7fd),
                        child: ListTile(
                          title: Text(comment.body),
                          subtitle: Text(shortDate(comment.createdAt)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
    checklistInput.dispose();
    commentInput.dispose();
  }

  Future<void> addGrowthGoal([GrowthGoal? existing]) async {
    final title = TextEditingController(text: existing?.title);
    final progress = TextEditingController(
      text: (existing?.progress ?? 0).toString(),
    );
    final nextAction = TextEditingController(text: existing?.nextAction);
    var area = existing?.area ?? 'learning';
    DateTime? targetDate = existing?.targetDate.isNotEmpty == true
        ? DateTime.tryParse(existing!.targetDate)
        : null;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(existing == null ? 'Tujuan baru' : 'Ubah tujuan'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: title,
                  autofocus: true,
                  decoration: const InputDecoration(labelText: 'Tujuan'),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: area,
                  decoration: const InputDecoration(labelText: 'Area'),
                  items: growthAreas
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text(growthAreaLabel(value)),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => area = value ?? 'personal'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: progress,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Progres 0–100'),
                ),
                const SizedBox(height: 8),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: Text(
                    targetDate == null
                        ? 'Tanpa tenggat'
                        : dateLabel(targetDate!),
                  ),
                  onTap: () async {
                    final value = await showDatePicker(
                      context: context,
                      firstDate: DateTime.now().subtract(
                        const Duration(days: 3650),
                      ),
                      lastDate: DateTime.now().add(const Duration(days: 3650)),
                      initialDate: targetDate ?? DateTime.now(),
                    );
                    if (value != null) {
                      setDialogState(() => targetDate = value);
                    }
                  },
                ),
                TextField(
                  controller: nextAction,
                  decoration: const InputDecoration(
                    labelText: 'Langkah berikutnya',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () {
                final value = int.tryParse(progress.text) ?? 0;
                if (title.text.trim().isEmpty) return;
                mutate(() {
                  final goal = GrowthGoal(
                    id: existing?.id ?? newId(),
                    title: title.text.trim(),
                    area: area,
                    progress: value.clamp(0, 100).toInt(),
                    targetDate: targetDate == null ? '' : dateKey(targetDate!),
                    nextAction: nextAction.text.trim(),
                    createdAt: existing?.createdAt ?? DateTime.now(),
                  );
                  final index = workspace.growthGoals.indexWhere(
                    (item) => item.id == goal.id,
                  );
                  if (index >= 0) {
                    workspace.growthGoals[index] = goal;
                  } else {
                    workspace.growthGoals.insert(0, goal);
                  }
                });
                Navigator.pop(context);
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    title.dispose();
    progress.dispose();
    nextAction.dispose();
  }

  Future<void> addFocusSession() async {
    final title = TextEditingController();
    final minutes = TextEditingController(text: '30');
    final note = TextEditingController();
    var area = 'learning';
    var date = DateTime.now();
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Catat sesi fokus'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: title,
                  autofocus: true,
                  decoration: const InputDecoration(labelText: 'Aktivitas'),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: area,
                  decoration: const InputDecoration(labelText: 'Area'),
                  items: growthAreas
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text(growthAreaLabel(value)),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => area = value ?? 'personal'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: minutes,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Durasi menit'),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: Text(dateLabel(date)),
                  onTap: () async {
                    final value = await showDatePicker(
                      context: context,
                      firstDate: DateTime(2000),
                      lastDate: DateTime.now().add(const Duration(days: 3650)),
                      initialDate: date,
                    );
                    if (value != null) setDialogState(() => date = value);
                  },
                ),
                TextField(
                  controller: note,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Catatan hasil'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () {
                final duration = int.tryParse(minutes.text) ?? 0;
                if (title.text.trim().isEmpty || duration <= 0) return;
                mutate(
                  () => workspace.focusSessions.insert(
                    0,
                    FocusSession(
                      id: newId(),
                      title: title.text.trim(),
                      area: area,
                      minutes: duration.clamp(1, 1440).toInt(),
                      date: date,
                      note: note.text.trim(),
                    ),
                  ),
                );
                Navigator.pop(context);
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    title.dispose();
    minutes.dispose();
    note.dispose();
  }

  Future<void> addDailyReview([DailyReview? existing]) async {
    final win = TextEditingController(text: existing?.win);
    final lesson = TextEditingController(text: existing?.lesson);
    final nextStep = TextEditingController(text: existing?.nextStep);
    var date = existing?.date ?? DateTime.now();
    var mood = existing?.mood ?? 4;
    var energy = existing?.energy ?? 4;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Refleksi harian'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: Text(dateLabel(date)),
                  onTap: () async {
                    final value = await showDatePicker(
                      context: context,
                      firstDate: DateTime(2000),
                      lastDate: DateTime.now().add(const Duration(days: 3650)),
                      initialDate: date,
                    );
                    if (value != null) setDialogState(() => date = value);
                  },
                ),
                DropdownButtonFormField<int>(
                  initialValue: mood,
                  decoration: const InputDecoration(labelText: 'Mood'),
                  items: [1, 2, 3, 4, 5]
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text('$value/5'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setDialogState(() => mood = value ?? 3),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<int>(
                  initialValue: energy,
                  decoration: const InputDecoration(labelText: 'Energi'),
                  items: [1, 2, 3, 4, 5]
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text('$value/5'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => energy = value ?? 3),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: win,
                  decoration: const InputDecoration(
                    labelText: 'Kemenangan hari ini',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: lesson,
                  decoration: const InputDecoration(labelText: 'Pelajaran'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: nextStep,
                  decoration: const InputDecoration(
                    labelText: 'Langkah berikutnya',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () {
                mutate(() {
                  final sameDate = workspace.dailyReviews.indexWhere(
                    (item) => dateKey(item.date) == dateKey(date),
                  );
                  final review = DailyReview(
                    id:
                        existing?.id ??
                        (sameDate >= 0
                            ? workspace.dailyReviews[sameDate].id
                            : newId()),
                    date: date,
                    mood: mood,
                    energy: energy,
                    win: win.text.trim(),
                    lesson: lesson.text.trim(),
                    nextStep: nextStep.text.trim(),
                  );
                  final index = workspace.dailyReviews.indexWhere(
                    (item) => item.id == review.id,
                  );
                  if (index >= 0) {
                    workspace.dailyReviews[index] = review;
                  } else {
                    workspace.dailyReviews.insert(0, review);
                  }
                });
                Navigator.pop(context);
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    win.dispose();
    lesson.dispose();
    nextStep.dispose();
  }

  Future<void> addTransaction([TransactionItem? existing]) async {
    final title = TextEditingController(text: existing?.title);
    final amount = TextEditingController(text: existing?.amount.toString());
    var isIncome = existing?.isIncome ?? false;
    var date = existing?.date ?? DateTime.now();
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(existing == null ? 'Transaksi baru' : 'Ubah transaksi'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Nama transaksi'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: amount,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Nominal'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<bool>(
                initialValue: isIncome,
                decoration: const InputDecoration(labelText: 'Jenis'),
                items: const [
                  DropdownMenuItem(value: false, child: Text('Pengeluaran')),
                  DropdownMenuItem(value: true, child: Text('Pemasukan')),
                ],
                onChanged: (value) =>
                    setDialogState(() => isIncome = value ?? false),
              ),
              const SizedBox(height: 10),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.calendar_today_outlined),
                title: Text(dateLabel(date)),
                onTap: () async {
                  final value = await showDatePicker(
                    context: context,
                    firstDate: DateTime(2000),
                    lastDate: DateTime.now().add(const Duration(days: 3650)),
                    initialDate: date,
                  );
                  if (value != null) setDialogState(() => date = value);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () {
                final parsed = int.tryParse(
                  amount.text.replaceAll(RegExp(r'\D'), ''),
                );
                if (title.text.trim().isEmpty ||
                    parsed == null ||
                    parsed <= 0) {
                  return;
                }
                mutate(() {
                  final item = TransactionItem(
                    id: existing?.id ?? newId(),
                    title: title.text.trim(),
                    amount: parsed,
                    isIncome: isIncome,
                    date: date,
                  );
                  final index = workspace.transactions.indexWhere(
                    (row) => row.id == item.id,
                  );
                  if (index >= 0) {
                    workspace.transactions[index] = item;
                  } else {
                    workspace.transactions.add(item);
                  }
                });
                Navigator.pop(context);
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    title.dispose();
    amount.dispose();
  }

  Future<void> addAgenda([AgendaItem? existing]) async {
    final title = TextEditingController(text: existing?.title);
    var date = existing?.date ?? DateTime.now();
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(existing == null ? 'Agenda baru' : 'Ubah agenda'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Judul agenda'),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.calendar_today_outlined),
                title: Text(dateLabel(date)),
                onTap: () async {
                  final value = await showDatePicker(
                    context: context,
                    firstDate: DateTime.now().subtract(
                      const Duration(days: 365),
                    ),
                    lastDate: DateTime.now().add(const Duration(days: 3650)),
                    initialDate: date,
                  );
                  if (value != null) setDialogState(() => date = value);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () {
                if (title.text.trim().isEmpty) return;
                mutate(() {
                  final item = AgendaItem(
                    id: existing?.id ?? newId(),
                    title: title.text.trim(),
                    date: date,
                    isDone: existing?.isDone ?? false,
                  );
                  final index = workspace.agenda.indexWhere(
                    (row) => row.id == item.id,
                  );
                  if (index >= 0) {
                    workspace.agenda[index] = item;
                  } else {
                    workspace.agenda.add(item);
                  }
                });
                Navigator.pop(context);
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    title.dispose();
  }

  Future<void> addNote([NoteItem? existing]) async {
    final title = TextEditingController(text: existing?.title);
    final body = TextEditingController(text: existing?.body);
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(existing == null ? 'Catatan baru' : 'Ubah catatan'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: title,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Judul'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: body,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(labelText: 'Isi catatan'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () {
              if (title.text.trim().isEmpty && body.text.trim().isEmpty) return;
              mutate(() {
                final item = NoteItem(
                  id: existing?.id ?? newId(),
                  title: title.text.trim().isEmpty
                      ? 'Catatan'
                      : title.text.trim(),
                  body: body.text.trim(),
                  updatedAt: DateTime.now(),
                );
                final index = workspace.notes.indexWhere(
                  (row) => row.id == item.id,
                );
                if (index >= 0) {
                  workspace.notes[index] = item;
                } else {
                  workspace.notes.add(item);
                }
              });
              Navigator.pop(context);
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
    title.dispose();
    body.dispose();
  }

  Future<void> addHabit([HabitItem? existing]) async {
    final name = TextEditingController(text: existing?.name);
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(existing == null ? 'Kebiasaan baru' : 'Ubah kebiasaan'),
        content: TextField(
          controller: name,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Nama kebiasaan'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () {
              if (name.text.trim().isEmpty) return;
              mutate(() {
                final item =
                    existing?.copyWith(name: name.text.trim()) ??
                    HabitItem.create(id: newId(), name: name.text.trim());
                final index = workspace.habits.indexWhere(
                  (row) => row.id == item.id,
                );
                if (index >= 0) {
                  workspace.habits[index] = item;
                } else {
                  workspace.habits.add(item);
                }
              });
              Navigator.pop(context);
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
    name.dispose();
  }

  Future<void> resetDemo() async {
    final accepted =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Pulihkan data demo?'),
            content: const Text('Data lokal saat ini akan diganti.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Batal'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Pulihkan'),
              ),
            ],
          ),
        ) ??
        false;
    if (accepted) mutate(() => workspace = WorkspaceData.demo());
  }

  bool matches(String value) =>
      searchQuery.isEmpty ||
      value.toLowerCase().contains(searchQuery.toLowerCase());

  Future<void> showSearchDialog() async {
    final controller = TextEditingController(text: searchQuery);
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cari data'),
        content: TextField(
          controller: controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(labelText: 'Kata pencarian'),
          onSubmitted: (value) => Navigator.pop(context, value.trim()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Cari'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value != null) setState(() => searchQuery = value);
  }

  Future<void> exportBackup() async {
    await Clipboard.setData(
      ClipboardData(text: widget.store.serialize(workspace)),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Cadangan JSON disalin ke clipboard.')),
    );
  }

  Future<void> importBackup() async {
    final serialized = (await Clipboard.getData('text/plain'))?.text;
    if (serialized == null || serialized.trim().isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Clipboard tidak berisi cadangan.')),
        );
      }
      return;
    }
    try {
      final imported = widget.store.deserialize(serialized);
      if (!mounted) return;
      final accepted =
          await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Pulihkan cadangan?'),
              content: const Text('Data lokal saat ini akan diganti.'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Batal'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Pulihkan'),
                ),
              ],
            ),
          ) ??
          false;
      if (accepted) mutate(() => workspace = imported);
    } on FormatException {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Cadangan tidak valid.')));
    }
  }

  Future<void> useServerData() async {
    if (!syncConfig.enabled) return;
    final accepted =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Gunakan data server?'),
            content: const Text(
              'Data lokal akan diganti dengan data bersama terbaru.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Batal'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Gunakan server'),
              ),
            ],
          ),
        ) ??
        false;
    if (accepted) await syncNow(useRemote: true);
  }

  Future<void> uploadLocalData() async {
    if (!syncConfig.enabled) return;
    final accepted =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Kirim data perangkat?'),
            content: const Text(
              'Data perangkat ini akan mengganti data bersama di server.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Batal'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Kirim perangkat'),
              ),
            ],
          ),
        ) ??
        false;
    if (accepted) await syncNow(forceLocal: true);
  }

  String displayMoney(int value) =>
      workspace.settings.hideBalances ? '••••••' : money(value);

  Future<void> showSettings() async {
    final budget = TextEditingController(
      text: workspace.settings.monthlyBudget == 0
          ? ''
          : workspace.settings.monthlyBudget.toString(),
    );
    final server = TextEditingController(text: syncConfig.serverUrl);
    final password = TextEditingController();
    var hideBalances = workspace.settings.hideBalances;
    String? syncError;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Pengaturan'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: budget,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Anggaran bulanan',
                  ),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Sembunyikan nominal'),
                  value: hideBalances,
                  onChanged: (value) =>
                      setDialogState(() => hideBalances = value),
                ),
                const Divider(height: 30),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'SINKRONISASI SEMUA PERANGKAT',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: clay,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: server,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'Alamat server',
                    hintText: 'https://command.example.com',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: password,
                  obscureText: true,
                  autocorrect: false,
                  enableSuggestions: false,
                  decoration: InputDecoration(
                    labelText: 'Kata sandi server',
                    hintText: syncConfig.password.isEmpty
                        ? 'Kosong jika server lokal tanpa sandi'
                        : 'Tersimpan aman di Keychain',
                  ),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    syncError ?? syncDescription,
                    style: TextStyle(
                      color: syncError == null
                          ? const Color(0xff66768d)
                          : danger,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () async {
                final parsed =
                    int.tryParse(budget.text.replaceAll(RegExp(r'\D'), '')) ??
                    0;
                final rawServer = server.text.trim();
                final normalized = rawServer.isEmpty
                    ? ''
                    : SyncConfig.normalizeUrl(rawServer);
                if (normalized == null) {
                  setDialogState(
                    () => syncError =
                        'Gunakan HTTPS. HTTP hanya untuk localhost.',
                  );
                  return;
                }
                final serverChanged = normalized != syncConfig.serverUrl;
                syncConfig = normalized.isEmpty
                    ? const SyncConfig()
                    : syncConfig.copyWith(
                        serverUrl: normalized,
                        password: password.text.isEmpty
                            ? syncConfig.password
                            : password.text,
                        revision: serverChanged ? 0 : syncConfig.revision,
                        dirty: serverChanged ? true : syncConfig.dirty,
                      );
                await widget.syncStore.saveCredentials(syncConfig);
                if (!context.mounted) return;
                mutate(() {
                  workspace.settings.monthlyBudget = parsed;
                  workspace.settings.hideBalances = hideBalances;
                });
                Navigator.pop(context);
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    budget.dispose();
    server.dispose();
    password.dispose();
  }
}

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.width,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final double width;
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 13),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                letterSpacing: .7,
                color: Color(0xff66768d),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle({super.key, required this.title, required this.subtitle});
  final String title;
  final String subtitle;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: const TextStyle(
          fontSize: 19,
          fontWeight: FontWeight.w800,
          color: ink,
        ),
      ),
      const SizedBox(height: 2),
      Text(
        subtitle,
        style: const TextStyle(fontSize: 12, color: Color(0xff66768d)),
      ),
    ],
  );
}

class EmptyCard extends StatelessWidget {
  const EmptyCard({super.key, required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(0xff66768d)),
        ),
      ),
    ),
  );
}

class TotalsCard extends StatelessWidget {
  const TotalsCard({
    super.key,
    required this.income,
    required this.expense,
    required this.hideBalances,
  });
  final int income;
  final int expense;
  final bool hideBalances;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(21),
    decoration: BoxDecoration(
      color: ink,
      borderRadius: BorderRadius.circular(24),
    ),
    child: Row(
      children: [
        Expanded(child: _total('PEMASUKAN', income, const Color(0xff93c5fd))),
        Container(width: 1, height: 42, color: Colors.white24),
        const SizedBox(width: 18),
        Expanded(
          child: _total('PENGELUARAN', expense, const Color(0xfffca5b5)),
        ),
      ],
    ),
  );
  Widget _total(String label, int value, Color color) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          letterSpacing: .8,
          color: Colors.white60,
          fontWeight: FontWeight.w700,
        ),
      ),
      const SizedBox(height: 7),
      FittedBox(
        child: Text(
          hideBalances ? '••••••' : money(value),
          style: TextStyle(
            color: color,
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    ],
  );
}

const months = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const weekdays = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];
String dateLabel(DateTime value) =>
    '${weekdays[value.weekday - 1]}, ${value.day} ${months[value.month - 1]} ${value.year}';
String shortDate(DateTime value) =>
    '${value.day} ${months[value.month - 1].substring(0, 3)} ${value.year}';
bool sameDay(DateTime first, DateTime second) =>
    first.year == second.year &&
    first.month == second.month &&
    first.day == second.day;
String money(int value) {
  final digits = value.abs().toString();
  final formatted = digits.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  return '${value < 0 ? '−' : ''}Rp $formatted';
}
