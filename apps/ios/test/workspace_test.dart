import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:personal_command_center/workspace.dart';

void main() {
  test(
    'workspace native dapat disimpan dan dipulihkan tanpa kehilangan data',
    () {
      final workspace = WorkspaceData.demo(DateTime(2026, 8, 24, 9));
      workspace.lifeOs['priorities'] = [
        {'id': 'priority-1', 'date': '2026-08-24', 'text': 'Uji v5', 'done': true},
      ];
      final restored = WorkspaceData.fromJson(
        jsonDecode(jsonEncode(workspace.toJson())),
      );

      expect(restored.transactions, hasLength(3));
      expect(restored.balance, 4027000);
      expect(restored.agenda.first.title, 'Review prioritas mingguan');
      expect(
        restored.habits.where(
          (item) => item.isCompletedOn(DateTime(2026, 8, 24)),
        ),
        hasLength(1),
      );
      expect(
        restored.habits.first.isCompletedOn(DateTime(2026, 8, 25)),
        isFalse,
      );
      expect(restored.growthGoals.single.progress, 35);
      expect(restored.focusSessions.single.minutes, 30);
      expect(restored.dailyReviews.single.mood, 4);
      expect(restored.projects.single.name, 'Bangun versi terbaik diri');
      expect(restored.tickets, hasLength(3));
      expect(restored.tickets[1].status, 'in_progress');
      expect(restored.lifeOs['priorities'], hasLength(1));
      expect(restored.toJson()['version'], 5);
    },
  );

  test('workspace rusak ditolak sebelum mengganti data lokal', () {
    expect(() => WorkspaceData.fromJson({'version': 1}), throwsFormatException);
    expect(
      () => WorkspaceData.fromJson({'version': 2, 'transactions': []}),
      throwsFormatException,
    );
  });

  test('kebiasaan hanya selesai pada tanggal yang dicatat', () {
    final habit = HabitItem.create(
      id: '1',
      name: 'Jalan kaki',
    ).toggle(DateTime(2026, 8, 24));

    expect(habit.isCompletedOn(DateTime(2026, 8, 24)), isTrue);
    expect(habit.isCompletedOn(DateTime(2026, 8, 25)), isFalse);
  });

  test('metrik perkembangan menghitung fokus, streak, dan pencapaian', () {
    final workspace = WorkspaceData.demo(DateTime(2026, 8, 24, 9));
    workspace.growthGoals[0] = workspace.growthGoals[0].copyWith(progress: 100);
    workspace.focusSessions[0] = FocusSession(
      id: workspace.focusSessions[0].id,
      title: 'Fokus',
      area: 'learning',
      minutes: 300,
      date: DateTime(2026, 8, 24),
      note: '',
    );
    final metrics = GrowthMetrics.calculate(
      workspace.growthGoals,
      workspace.focusSessions,
      workspace.dailyReviews,
      DateTime(2026, 8, 24),
    );

    expect(metrics.growthScore, 87);
    expect(metrics.weeklyMinutes, 300);
    expect(metrics.achievements, contains('Goal getter'));
    expect(metrics.achievements, contains('Fokus 5 jam'));
  });

  test('sinkronisasi hanya menerima HTTPS atau localhost', () {
    expect(
      SyncConfig.normalizeUrl('https://command.example.com/path'),
      'https://command.example.com',
    );
    expect(
      SyncConfig.normalizeUrl('http://localhost:3001'),
      'http://localhost:3001',
    );
    expect(SyncConfig.normalizeUrl('http://command.example.com'), isNull);
  });

  test('PIN aplikasi wajib enam digit', () {
    expect(isValidAppPin('482931'), isTrue);
    expect(isValidAppPin('12345'), isFalse);
    expect(isValidAppPin('12A456'), isFalse);
  });

  test(
    'iOS dapat membaca dan menulis workspace pusat bila server tersedia',
    () async {
      final url = Platform.environment['PCC_SYNC_TEST_URL'];
      if (url == null) return;
      final client = NativeSyncClient();
      var config = SyncConfig(
        serverUrl: url,
        password: Platform.environment['PCC_SYNC_TEST_PASSWORD'] ?? '',
      );
      final remote = await client.get(config);
      expect(remote.isSuccess, isTrue);
      expect(remote.data?.transactions.single.title, 'Data tersinkron');
      expect(remote.data?.growthGoals, hasLength(2));
      expect(remote.data?.focusSessions, hasLength(1));
      expect(remote.data?.dailyReviews, hasLength(1));
      expect(remote.data?.projects, hasLength(1));
      expect(remote.data?.tickets, isNotEmpty);
      config = config.copyWith(revision: remote.revision);
      final uploaded = await client.put(config, remote.data!);
      expect(uploaded.isSuccess, isTrue);
      expect(uploaded.revision, remote.revision + 1);
    },
  );
}
