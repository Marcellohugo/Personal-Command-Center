import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

typedef JsonMap = Map<String, dynamic>;

JsonMap emptyLifeOs() => {
  'cycle': {
    'id': 'cycle-1',
    'name': 'Siklus 1',
    'startDate': '',
    'endDate': '',
    'status': 'setup',
    'copiedGoalIds': <String>[],
  },
  'checkIns': <Object>[],
  'priorities': <Object>[],
  'weeklyReviews': <Object>[],
  'weeklyQuests': <Object>[],
  'gamification': {
    'totalXp': 0,
    'achievements': <Object>[],
    'ritualDays': <String>[],
    'perfectDays': <String>[],
    'lastAwardKeys': <String>[],
  },
};

class WorkspaceData {
  WorkspaceData({
    required this.transactions,
    required this.agenda,
    required this.notes,
    required this.habits,
    required this.growthGoals,
    required this.focusSessions,
    required this.dailyReviews,
    required this.projects,
    required this.tickets,
    required this.settings,
    JsonMap? lifeOs,
  }) : lifeOs = lifeOs ?? emptyLifeOs();

  final List<TransactionItem> transactions;
  final List<AgendaItem> agenda;
  final List<NoteItem> notes;
  final List<HabitItem> habits;
  final List<GrowthGoal> growthGoals;
  final List<FocusSession> focusSessions;
  final List<DailyReview> dailyReviews;
  final List<ProjectBoard> projects;
  final List<KanbanTicket> tickets;
  final WorkspaceSettings settings;
  final JsonMap lifeOs;

  int get balance => transactions.fold(
    0,
    (sum, item) => sum + (item.isIncome ? item.amount : -item.amount),
  );
  int get monthExpenses {
    final now = DateTime.now();
    return transactions
        .where(
          (item) =>
              !item.isIncome &&
              item.date.year == now.year &&
              item.date.month == now.month,
        )
        .fold(0, (sum, item) => sum + item.amount);
  }

  JsonMap toJson() => {
    'version': 5,
    'transactions': transactions.map((item) => item.toJson()).toList(),
    'agenda': agenda.map((item) => item.toJson()).toList(),
    'notes': notes.map((item) => item.toJson()).toList(),
    'habits': habits.map((item) => item.toJson()).toList(),
    'growthGoals': growthGoals.map((item) => item.toJson()).toList(),
    'focusSessions': focusSessions.map((item) => item.toJson()).toList(),
    'dailyReviews': dailyReviews.map((item) => item.toJson()).toList(),
    'projects': projects.map((item) => item.toJson()).toList(),
    'tickets': tickets.map((item) => item.toJson()).toList(),
    'settings': settings.toJson(),
    'lifeOs': lifeOs,
  };

  factory WorkspaceData.fromJson(Object? value) {
    if (value is! JsonMap ||
        (value['version'] != 1 &&
            value['version'] != 2 &&
            value['version'] != 3 &&
            value['version'] != 4 &&
            value['version'] != 5)) {
      throw const FormatException('Workspace tidak valid.');
    }
    List<T> read<T>(
      String key,
      T Function(JsonMap) parse, {
      bool optional = false,
    }) {
      final rows = value[key];
      if (rows == null && optional) return [];
      if (rows is! List) throw FormatException('$key tidak valid.');
      return rows.map((row) {
        if (row is! JsonMap) throw FormatException('$key tidak valid.');
        return parse(row);
      }).toList();
    }

    return WorkspaceData(
      transactions: read('transactions', TransactionItem.fromJson),
      agenda: read('agenda', AgendaItem.fromJson),
      notes: read('notes', NoteItem.fromJson),
      habits: read('habits', HabitItem.fromJson),
      growthGoals: read('growthGoals', GrowthGoal.fromJson, optional: true),
      focusSessions: read(
        'focusSessions',
        FocusSession.fromJson,
        optional: true,
      ),
      dailyReviews: read('dailyReviews', DailyReview.fromJson, optional: true),
      projects: read('projects', ProjectBoard.fromJson, optional: true),
      tickets: read('tickets', KanbanTicket.fromJson, optional: true),
      settings: WorkspaceSettings.fromJson(
        value['settings'] is JsonMap ? value['settings'] as JsonMap : {},
      ),
      lifeOs: value['lifeOs'] is JsonMap
          ? Map<String, dynamic>.from(value['lifeOs'] as JsonMap)
          : emptyLifeOs(),
    );
  }

  factory WorkspaceData.demo([DateTime? reference]) {
    final now = reference ?? DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final projectId = newId();
    return WorkspaceData(
      transactions: [
        TransactionItem(
          id: newId(),
          title: 'Honor proyek',
          amount: 4500000,
          isIncome: true,
          date: today.subtract(const Duration(days: 2)),
        ),
        TransactionItem(
          id: newId(),
          title: 'Belanja mingguan',
          amount: 425000,
          isIncome: false,
          date: today.subtract(const Duration(days: 1)),
        ),
        TransactionItem(
          id: newId(),
          title: 'Kopi dan sarapan',
          amount: 48000,
          isIncome: false,
          date: today,
        ),
      ],
      agenda: [
        AgendaItem(
          id: newId(),
          title: 'Review prioritas mingguan',
          date: today,
          isDone: false,
        ),
        AgendaItem(
          id: newId(),
          title: 'Olahraga ringan',
          date: today.add(const Duration(days: 1)),
          isDone: false,
        ),
      ],
      notes: [
        NoteItem(
          id: newId(),
          title: 'Fokus minggu ini',
          body: 'Selesaikan satu pekerjaan penting sebelum membuka pesan.',
          updatedAt: now,
        ),
      ],
      habits: [
        HabitItem.create(
          id: newId(),
          name: 'Minum air putih',
          completedToday: true,
          reference: now,
        ),
        HabitItem.create(id: newId(), name: 'Membaca 20 menit'),
        HabitItem.create(id: newId(), name: 'Jalan kaki'),
      ],
      growthGoals: [
        GrowthGoal(
          id: newId(),
          title: 'Tingkatkan kemampuan utama',
          area: 'learning',
          progress: 35,
          targetDate: dateKey(today.add(const Duration(days: 45))),
          nextAction: 'Latihan fokus 30 menit',
          createdAt: now,
        ),
      ],
      focusSessions: [
        FocusSession(
          id: newId(),
          title: 'Belajar terarah',
          area: 'learning',
          minutes: 30,
          date: today,
          note: 'Satu konsep baru dipahami.',
        ),
      ],
      dailyReviews: [
        DailyReview(
          id: newId(),
          date: today,
          mood: 4,
          energy: 4,
          win: 'Menentukan prioritas utama',
          lesson: 'Kemajuan kecil tetap berarti',
          nextStep: 'Kerjakan langkah berikutnya sebelum membuka pesan',
        ),
      ],
      projects: [
        ProjectBoard(
          id: projectId,
          name: 'Bangun versi terbaik diri',
          description: 'Board utama untuk mengubah rencana menjadi progres.',
          color: '#2563EB',
          archived: false,
          createdAt: now,
        ),
      ],
      tickets: [
        KanbanTicket.create(
          projectId: projectId,
          title: 'Susun prioritas minggu ini',
          description: 'Pilih tiga hasil terpenting yang ingin diselesaikan.',
          status: 'ready',
          priority: 'high',
          labels: const ['rencana'],
        ),
        KanbanTicket.create(
          projectId: projectId,
          title: 'Jalankan sesi fokus pertama',
          description: 'Mulai dari 30 menit tanpa gangguan.',
          status: 'in_progress',
          labels: const ['fokus'],
        ),
        KanbanTicket.create(
          projectId: projectId,
          title: 'Catat kemenangan hari ini',
          description: 'Tutup hari dengan bukti kemajuan kecil.',
          status: 'done',
          priority: 'low',
          labels: const ['refleksi'],
        ),
      ],
      settings: WorkspaceSettings(monthlyBudget: 5000000),
    );
  }
}

class WorkspaceSettings {
  WorkspaceSettings({this.monthlyBudget = 0, this.hideBalances = false});
  int monthlyBudget;
  bool hideBalances;

  JsonMap toJson() => {
    'monthlyBudget': monthlyBudget,
    'hideBalances': hideBalances,
  };

  factory WorkspaceSettings.fromJson(JsonMap value) => WorkspaceSettings(
    monthlyBudget: value['monthlyBudget'] is num
        ? max(0, (value['monthlyBudget'] as num).round())
        : 0,
    hideBalances: value['hideBalances'] == true,
  );
}

class TransactionItem {
  const TransactionItem({
    required this.id,
    required this.title,
    required this.amount,
    required this.isIncome,
    required this.date,
  });
  final String id;
  final String title;
  final int amount;
  final bool isIncome;
  final DateTime date;
  JsonMap toJson() => {
    'id': id,
    'title': title,
    'amount': amount,
    'isIncome': isIncome,
    'date': date.toIso8601String(),
  };
  factory TransactionItem.fromJson(JsonMap value) => TransactionItem(
    id: _text(value, 'id'),
    title: _text(value, 'title'),
    amount: _positiveInt(value, 'amount'),
    isIncome: value['isIncome'] == true,
    date: _date(value, 'date'),
  );
}

class AgendaItem {
  const AgendaItem({
    required this.id,
    required this.title,
    required this.date,
    required this.isDone,
  });
  final String id;
  final String title;
  final DateTime date;
  final bool isDone;
  AgendaItem copyWith({bool? isDone}) => AgendaItem(
    id: id,
    title: title,
    date: date,
    isDone: isDone ?? this.isDone,
  );
  JsonMap toJson() => {
    'id': id,
    'title': title,
    'date': date.toIso8601String(),
    'isDone': isDone,
  };
  factory AgendaItem.fromJson(JsonMap value) => AgendaItem(
    id: _text(value, 'id'),
    title: _text(value, 'title'),
    date: _date(value, 'date'),
    isDone: value['isDone'] == true,
  );
}

class NoteItem {
  const NoteItem({
    required this.id,
    required this.title,
    required this.body,
    required this.updatedAt,
  });
  final String id;
  final String title;
  final String body;
  final DateTime updatedAt;
  JsonMap toJson() => {
    'id': id,
    'title': title,
    'body': body,
    'updatedAt': updatedAt.toIso8601String(),
  };
  factory NoteItem.fromJson(JsonMap value) => NoteItem(
    id: _text(value, 'id'),
    title: _text(value, 'title'),
    body: value['body'] is String ? value['body'] as String : '',
    updatedAt: _date(value, 'updatedAt'),
  );
}

class HabitItem {
  const HabitItem({
    required this.id,
    required this.name,
    required this.completedDates,
  });
  final String id;
  final String name;
  final Set<String> completedDates;

  factory HabitItem.create({
    required String id,
    required String name,
    bool completedToday = false,
    DateTime? reference,
  }) => HabitItem(
    id: id,
    name: name,
    completedDates: completedToday
        ? {dateKey(reference ?? DateTime.now())}
        : {},
  );

  bool isCompletedOn(DateTime date) => completedDates.contains(dateKey(date));
  bool get isDoneToday => isCompletedOn(DateTime.now());
  int get currentStreak {
    var cursor = DateTime.now();
    var streak = 0;
    while (completedDates.contains(dateKey(cursor))) {
      streak += 1;
      cursor = cursor.subtract(const Duration(days: 1));
    }
    return streak;
  }

  HabitItem copyWith({String? name, Set<String>? completedDates}) => HabitItem(
    id: id,
    name: name ?? this.name,
    completedDates: completedDates ?? this.completedDates,
  );

  HabitItem toggle(DateTime date) {
    final key = dateKey(date);
    final next = {...completedDates};
    if (!next.remove(key)) next.add(key);
    return copyWith(completedDates: next);
  }

  JsonMap toJson() => {
    'id': id,
    'name': name,
    'completedDates': completedDates.toList()..sort(),
  };
  factory HabitItem.fromJson(JsonMap value) {
    final dates = value['completedDates'];
    final completed = dates is List
        ? dates.whereType<String>().where(isDateKey).toSet()
        : <String>{};
    if (value['isDoneToday'] == true) completed.add(dateKey(DateTime.now()));
    return HabitItem(
      id: _text(value, 'id'),
      name: _text(value, 'name'),
      completedDates: completed,
    );
  }
}

const growthAreas = ['career', 'learning', 'health', 'finance', 'personal'];

String normalizeGrowthArea(Object? value) =>
    value is String && growthAreas.contains(value) ? value : 'personal';

String growthAreaLabel(String value) => switch (value) {
  'career' => 'Karier',
  'learning' => 'Belajar',
  'health' => 'Kesehatan',
  'finance' => 'Keuangan',
  _ => 'Pribadi',
};

class GrowthGoal {
  const GrowthGoal({
    required this.id,
    required this.title,
    required this.area,
    required this.progress,
    required this.targetDate,
    required this.nextAction,
    required this.createdAt,
  });
  final String id;
  final String title;
  final String area;
  final int progress;
  final String targetDate;
  final String nextAction;
  final DateTime createdAt;
  bool get isComplete => progress >= 100;
  GrowthGoal copyWith({
    String? title,
    String? area,
    int? progress,
    String? targetDate,
    String? nextAction,
  }) => GrowthGoal(
    id: id,
    title: title ?? this.title,
    area: area ?? this.area,
    progress: (progress ?? this.progress).clamp(0, 100).toInt(),
    targetDate: targetDate ?? this.targetDate,
    nextAction: nextAction ?? this.nextAction,
    createdAt: createdAt,
  );
  JsonMap toJson() => {
    'id': id,
    'title': title,
    'area': area,
    'progress': progress,
    'targetDate': targetDate,
    'nextAction': nextAction,
    'createdAt': createdAt.toIso8601String(),
  };
  factory GrowthGoal.fromJson(JsonMap value) => GrowthGoal(
    id: _text(value, 'id'),
    title: _text(value, 'title'),
    area: normalizeGrowthArea(value['area']),
    progress:
        (value['progress'] is num ? (value['progress'] as num).round() : 0)
            .clamp(0, 100)
            .toInt(),
    targetDate:
        value['targetDate'] is String &&
            isDateKey(value['targetDate'] as String)
        ? value['targetDate'] as String
        : '',
    nextAction: value['nextAction'] is String
        ? value['nextAction'] as String
        : '',
    createdAt: _date(value, 'createdAt'),
  );
}

const kanbanStatuses = ['backlog', 'ready', 'in_progress', 'review', 'done'];
const ticketPriorities = ['low', 'medium', 'high', 'urgent'];

String kanbanStatusLabel(String value) => switch (value) {
  'ready' => 'Siap',
  'in_progress' => 'Dikerjakan',
  'review' => 'Review',
  'done' => 'Selesai',
  _ => 'Backlog',
};

String ticketPriorityLabel(String value) => switch (value) {
  'low' => 'Rendah',
  'high' => 'Tinggi',
  'urgent' => 'Mendesak',
  _ => 'Sedang',
};

class ProjectBoard {
  const ProjectBoard({
    required this.id,
    required this.name,
    required this.description,
    required this.color,
    required this.archived,
    required this.createdAt,
  });
  final String id;
  final String name;
  final String description;
  final String color;
  final bool archived;
  final DateTime createdAt;

  ProjectBoard copyWith({bool? archived}) => ProjectBoard(
    id: id,
    name: name,
    description: description,
    color: color,
    archived: archived ?? this.archived,
    createdAt: createdAt,
  );

  JsonMap toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'color': color,
    'archived': archived,
    'createdAt': createdAt.toIso8601String(),
  };

  factory ProjectBoard.fromJson(JsonMap value) => ProjectBoard(
    id: _text(value, 'id'),
    name: _text(value, 'name'),
    description: value['description'] is String
        ? value['description'] as String
        : '',
    color:
        value['color'] is String &&
            RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(value['color'] as String)
        ? value['color'] as String
        : '#2563EB',
    archived: value['archived'] == true,
    createdAt: _date(value, 'createdAt'),
  );
}

class TicketChecklistItem {
  const TicketChecklistItem({
    required this.id,
    required this.text,
    required this.done,
  });
  final String id;
  final String text;
  final bool done;
  TicketChecklistItem copyWith({bool? done}) =>
      TicketChecklistItem(id: id, text: text, done: done ?? this.done);
  JsonMap toJson() => {'id': id, 'text': text, 'done': done};
  factory TicketChecklistItem.fromJson(JsonMap value) => TicketChecklistItem(
    id: _text(value, 'id'),
    text: _text(value, 'text'),
    done: value['done'] == true,
  );
}

class TicketComment {
  const TicketComment({
    required this.id,
    required this.body,
    required this.createdAt,
  });
  final String id;
  final String body;
  final DateTime createdAt;
  JsonMap toJson() => {
    'id': id,
    'body': body,
    'createdAt': createdAt.toIso8601String(),
  };
  factory TicketComment.fromJson(JsonMap value) => TicketComment(
    id: _text(value, 'id'),
    body: _text(value, 'body'),
    createdAt: _date(value, 'createdAt'),
  );
}

class KanbanTicket {
  const KanbanTicket({
    required this.id,
    required this.projectId,
    required this.title,
    required this.description,
    required this.status,
    required this.priority,
    required this.labels,
    required this.dueDate,
    required this.checklist,
    required this.comments,
    required this.linkedScheduleId,
    required this.linkedGrowthGoalId,
    required this.archived,
    required this.order,
    required this.createdAt,
    required this.updatedAt,
  });
  final String id;
  final String projectId;
  final String title;
  final String description;
  final String status;
  final String priority;
  final List<String> labels;
  final String dueDate;
  final List<TicketChecklistItem> checklist;
  final List<TicketComment> comments;
  final String? linkedScheduleId;
  final String? linkedGrowthGoalId;
  final bool archived;
  final int order;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory KanbanTicket.create({
    required String projectId,
    required String title,
    String description = '',
    String status = 'backlog',
    String priority = 'medium',
    List<String> labels = const [],
    String dueDate = '',
    String? linkedScheduleId,
    String? linkedGrowthGoalId,
  }) {
    final now = DateTime.now();
    return KanbanTicket(
      id: newId(),
      projectId: projectId,
      title: title,
      description: description,
      status: status,
      priority: priority,
      labels: [...labels],
      dueDate: dueDate,
      checklist: const [],
      comments: const [],
      linkedScheduleId: linkedScheduleId,
      linkedGrowthGoalId: linkedGrowthGoalId,
      archived: false,
      order: now.microsecondsSinceEpoch,
      createdAt: now,
      updatedAt: now,
    );
  }

  KanbanTicket copyWith({
    String? title,
    String? description,
    String? status,
    String? priority,
    List<String>? labels,
    String? dueDate,
    List<TicketChecklistItem>? checklist,
    List<TicketComment>? comments,
    String? linkedScheduleId,
    String? linkedGrowthGoalId,
    bool? archived,
    DateTime? updatedAt,
  }) => KanbanTicket(
    id: id,
    projectId: projectId,
    title: title ?? this.title,
    description: description ?? this.description,
    status: status ?? this.status,
    priority: priority ?? this.priority,
    labels: labels ?? this.labels,
    dueDate: dueDate ?? this.dueDate,
    checklist: checklist ?? this.checklist,
    comments: comments ?? this.comments,
    linkedScheduleId: linkedScheduleId ?? this.linkedScheduleId,
    linkedGrowthGoalId: linkedGrowthGoalId ?? this.linkedGrowthGoalId,
    archived: archived ?? this.archived,
    order: order,
    createdAt: createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );

  JsonMap toJson() => {
    'id': id,
    'projectId': projectId,
    'title': title,
    'description': description,
    'status': status,
    'priority': priority,
    'labels': labels,
    'dueDate': dueDate,
    'checklist': checklist.map((item) => item.toJson()).toList(),
    'comments': comments.map((item) => item.toJson()).toList(),
    if (linkedScheduleId != null) 'linkedScheduleId': linkedScheduleId,
    if (linkedGrowthGoalId != null) 'linkedGrowthGoalId': linkedGrowthGoalId,
    'archived': archived,
    'order': order,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  factory KanbanTicket.fromJson(JsonMap value) {
    List<T> rows<T>(String key, T Function(JsonMap) parse) {
      final source = value[key];
      if (source is! List) return [];
      return source.whereType<JsonMap>().map(parse).toList();
    }

    final rawLabels = value['labels'];
    final status = value['status'];
    final priority = value['priority'];
    final dueDate = value['dueDate'];
    return KanbanTicket(
      id: _text(value, 'id'),
      projectId: _text(value, 'projectId'),
      title: _text(value, 'title'),
      description: value['description'] is String
          ? value['description'] as String
          : '',
      status: status is String && kanbanStatuses.contains(status)
          ? status
          : 'backlog',
      priority: priority is String && ticketPriorities.contains(priority)
          ? priority
          : 'medium',
      labels: rawLabels is List
          ? rawLabels.whereType<String>().take(10).toList()
          : [],
      dueDate: dueDate is String && isDateKey(dueDate) ? dueDate : '',
      checklist: rows('checklist', TicketChecklistItem.fromJson),
      comments: rows('comments', TicketComment.fromJson),
      linkedScheduleId: value['linkedScheduleId'] is String
          ? value['linkedScheduleId'] as String
          : null,
      linkedGrowthGoalId: value['linkedGrowthGoalId'] is String
          ? value['linkedGrowthGoalId'] as String
          : null,
      archived: value['archived'] == true,
      order: value['order'] is num
          ? max(0, (value['order'] as num).round())
          : 0,
      createdAt: _date(value, 'createdAt'),
      updatedAt: _date(value, 'updatedAt'),
    );
  }
}

class FocusSession {
  const FocusSession({
    required this.id,
    required this.title,
    required this.area,
    required this.minutes,
    required this.date,
    required this.note,
  });
  final String id;
  final String title;
  final String area;
  final int minutes;
  final DateTime date;
  final String note;
  JsonMap toJson() => {
    'id': id,
    'title': title,
    'area': area,
    'minutes': minutes,
    'date': date.toIso8601String(),
    'note': note,
  };
  factory FocusSession.fromJson(JsonMap value) => FocusSession(
    id: _text(value, 'id'),
    title: _text(value, 'title'),
    area: normalizeGrowthArea(value['area']),
    minutes: _positiveInt(value, 'minutes').clamp(1, 1440).toInt(),
    date: _date(value, 'date'),
    note: value['note'] is String ? value['note'] as String : '',
  );
}

class DailyReview {
  const DailyReview({
    required this.id,
    required this.date,
    required this.mood,
    required this.energy,
    required this.win,
    required this.lesson,
    required this.nextStep,
  });
  final String id;
  final DateTime date;
  final int mood;
  final int energy;
  final String win;
  final String lesson;
  final String nextStep;
  JsonMap toJson() => {
    'id': id,
    'date': date.toIso8601String(),
    'mood': mood,
    'energy': energy,
    'win': win,
    'lesson': lesson,
    'nextStep': nextStep,
  };
  factory DailyReview.fromJson(JsonMap value) => DailyReview(
    id: _text(value, 'id'),
    date: _date(value, 'date'),
    mood: (value['mood'] is num ? (value['mood'] as num).round() : 3)
        .clamp(1, 5)
        .toInt(),
    energy: (value['energy'] is num ? (value['energy'] as num).round() : 3)
        .clamp(1, 5)
        .toInt(),
    win: value['win'] is String ? value['win'] as String : '',
    lesson: value['lesson'] is String ? value['lesson'] as String : '',
    nextStep: value['nextStep'] is String ? value['nextStep'] as String : '',
  );
}

class GrowthMetrics {
  const GrowthMetrics({
    required this.activeGoals,
    required this.completedGoals,
    required this.averageProgress,
    required this.weeklyMinutes,
    required this.reviewStreak,
    required this.averageMood,
    required this.growthScore,
    required this.achievements,
  });
  final int activeGoals;
  final int completedGoals;
  final int averageProgress;
  final int weeklyMinutes;
  final int reviewStreak;
  final double averageMood;
  final int growthScore;
  final List<String> achievements;

  factory GrowthMetrics.calculate(
    List<GrowthGoal> goals,
    List<FocusSession> sessions,
    List<DailyReview> reviews, [
    DateTime? reference,
  ]) {
    final end = DateTime(
      (reference ?? DateTime.now()).year,
      (reference ?? DateTime.now()).month,
      (reference ?? DateTime.now()).day,
    );
    final startKey = dateKey(end.subtract(const Duration(days: 6)));
    final endKey = dateKey(end);
    final weeklySessions = sessions.where((item) {
      final key = dateKey(item.date);
      return key.compareTo(startKey) >= 0 && key.compareTo(endKey) <= 0;
    });
    final weeklyReviews = reviews.where((item) {
      final key = dateKey(item.date);
      return key.compareTo(startKey) >= 0 && key.compareTo(endKey) <= 0;
    }).toList();
    final completed = goals.where((item) => item.isComplete).length;
    final average = goals.isEmpty
        ? 0
        : (goals.fold<int>(0, (sum, item) => sum + item.progress) /
                  goals.length)
              .round();
    final weeklyMinutes = weeklySessions.fold<int>(
      0,
      (sum, item) => sum + item.minutes,
    );
    final averageMood = weeklyReviews.isEmpty
        ? 0.0
        : weeklyReviews.fold<int>(0, (sum, item) => sum + item.mood) /
              weeklyReviews.length;
    final reviewDates = reviews.map((item) => dateKey(item.date)).toSet();
    var cursor = end;
    if (!reviewDates.contains(dateKey(cursor))) {
      cursor = cursor.subtract(const Duration(days: 1));
    }
    var streak = 0;
    while (reviewDates.contains(dateKey(cursor))) {
      streak += 1;
      cursor = cursor.subtract(const Duration(days: 1));
    }
    final score = min(
      100,
      (average * .5 +
              min(weeklyMinutes / 300, 1) * 25 +
              min(streak / 7, 1) * 15 +
              min(completed, 1) * 10)
          .round(),
    );
    final totalMinutes = sessions.fold<int>(
      0,
      (sum, item) => sum + item.minutes,
    );
    return GrowthMetrics(
      activeGoals: goals.length - completed,
      completedGoals: completed,
      averageProgress: average,
      weeklyMinutes: weeklyMinutes,
      reviewStreak: streak,
      averageMood: double.parse(averageMood.toStringAsFixed(1)),
      growthScore: score,
      achievements: [
        if (goals.isNotEmpty) 'Langkah pertama',
        if (weeklyMinutes >= 100) 'Momentum 100 menit',
        if (streak >= 3) 'Refleksi konsisten',
        if (completed > 0) 'Goal getter',
        if (totalMinutes >= 300) 'Fokus 5 jam',
      ],
    );
  }
}

class LocalWorkspaceStore {
  static const _key = 'personal_command_center_native_v1';
  static const _corruptKey = 'personal_command_center_native_corrupt_backup';
  final SharedPreferencesAsync _preferences = SharedPreferencesAsync();

  Future<WorkspaceData> load() async {
    final serialized = await _preferences.getString(_key);
    if (serialized == null) return WorkspaceData.demo();
    try {
      return deserialize(serialized);
    } on FormatException {
      await _preferences.setString(_corruptKey, serialized);
      return WorkspaceData.demo();
    }
  }

  // ponytail: one local JSON value is enough for the offline MVP; move to SQLite when data volume or query needs grow.
  Future<void> save(WorkspaceData workspace) =>
      _preferences.setString(_key, serialize(workspace));

  String serialize(WorkspaceData workspace) => jsonEncode(workspace.toJson());

  WorkspaceData deserialize(String serialized) =>
      WorkspaceData.fromJson(jsonDecode(serialized));
}

class SyncConfig {
  const SyncConfig({
    this.serverUrl = '',
    this.password = '',
    this.revision = 0,
    this.dirty = false,
  });

  final String serverUrl;
  final String password;
  final int revision;
  final bool dirty;
  bool get enabled => serverUrl.isNotEmpty;

  SyncConfig copyWith({
    String? serverUrl,
    String? password,
    int? revision,
    bool? dirty,
  }) => SyncConfig(
    serverUrl: serverUrl ?? this.serverUrl,
    password: password ?? this.password,
    revision: revision ?? this.revision,
    dirty: dirty ?? this.dirty,
  );

  static String? normalizeUrl(String value) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) return null;
    final local =
        uri.host == 'localhost' || uri.host == '127.0.0.1' || uri.host == '::1';
    if (uri.scheme != 'https' && !(uri.scheme == 'http' && local)) return null;
    return uri.origin;
  }
}

class SyncConfigStore {
  static const _urlKey = 'personal_command_center_sync_url';
  static const _revisionKey = 'personal_command_center_sync_revision';
  static const _dirtyKey = 'personal_command_center_sync_dirty';
  static const _channel = MethodChannel(
    'personal_command_center/secure_storage',
  );
  final SharedPreferencesAsync _preferences = SharedPreferencesAsync();

  Future<SyncConfig> load() async {
    var password = '';
    try {
      password = await _channel.invokeMethod<String>('readPassword') ?? '';
    } on PlatformException {
      password = '';
    } on MissingPluginException {
      password = '';
    }
    return SyncConfig(
      serverUrl: await _preferences.getString(_urlKey) ?? '',
      password: password,
      revision: max(0, await _preferences.getInt(_revisionKey) ?? 0),
      dirty: await _preferences.getBool(_dirtyKey) ?? false,
    );
  }

  Future<void> saveState(SyncConfig config) async {
    await _preferences.setString(_urlKey, config.serverUrl);
    await _preferences.setInt(_revisionKey, config.revision);
    await _preferences.setBool(_dirtyKey, config.dirty);
  }

  Future<void> saveCredentials(SyncConfig config) async {
    await saveState(config);
    await _channel.invokeMethod<void>(
      config.password.isEmpty ? 'deletePassword' : 'writePassword',
      config.password.isEmpty ? null : config.password,
    );
  }
}

bool isValidAppPin(String pin) => RegExp(r'^\d{6}$').hasMatch(pin);

class AppLockStore {
  static const _channel = MethodChannel(
    'personal_command_center/secure_storage',
  );

  Future<bool> isConfigured() async {
    try {
      return await _channel.invokeMethod<bool>('hasAppPin') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<bool> verify(String pin) async {
    try {
      return await _channel.invokeMethod<bool>('verifyAppPin', pin) ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<void> save(String pin) async {
    final saved = await _channel.invokeMethod<bool>('writeAppPin', pin);
    if (saved != true) throw PlatformException(code: 'KEYCHAIN_WRITE');
  }
}

class SyncResponse {
  const SyncResponse({
    required this.statusCode,
    this.data,
    this.revision = 0,
    this.exists = false,
    this.error,
  });
  final int statusCode;
  final WorkspaceData? data;
  final int revision;
  final bool exists;
  final String? error;
  bool get isSuccess => statusCode >= 200 && statusCode < 300;
  bool get isConflict => statusCode == HttpStatus.conflict;
}

class NativeSyncClient {
  Future<SyncResponse> get(SyncConfig config) => _send('GET', config);

  Future<SyncResponse> put(
    SyncConfig config,
    WorkspaceData workspace, {
    bool force = false,
  }) => _send(
    'PUT',
    config,
    body: jsonEncode({
      'data': workspace.toJson(),
      'baseRevision': config.revision,
      'force': force,
    }),
  );

  Future<SyncResponse> _send(
    String method,
    SyncConfig config, {
    String? body,
  }) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final endpoint = Uri.parse('${config.serverUrl}/api/native-workspace');
      final request = await client.openUrl(method, endpoint);
      request.headers.set(HttpHeaders.acceptHeader, ContentType.json.mimeType);
      if (config.password.isNotEmpty) {
        request.headers.set(
          HttpHeaders.authorizationHeader,
          'Bearer ${config.password}',
        );
      }
      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.write(body);
      }
      final response = await request.close();
      final serialized = await utf8.decoder.bind(response).join();
      try {
        final value = jsonDecode(serialized);
        if (value is! JsonMap) {
          return SyncResponse(statusCode: response.statusCode);
        }
        return SyncResponse(
          statusCode: response.statusCode,
          data: value['data'] is JsonMap
              ? WorkspaceData.fromJson(value['data'])
              : null,
          revision: value['revision'] is num
              ? max(0, (value['revision'] as num).round())
              : config.revision,
          exists: value['exists'] == true,
          error: value['error'] is String ? value['error'] as String : null,
        );
      } on FormatException {
        return SyncResponse(
          statusCode: response.statusCode,
          error: 'Respons server tidak valid.',
        );
      }
    } finally {
      client.close(force: true);
    }
  }
}

final _random = Random.secure();
String newId() =>
    '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${_random.nextInt(0x100000000).toRadixString(36)}';

String dateKey(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

bool isDateKey(String value) {
  final parsed = DateTime.tryParse(value);
  return parsed != null && dateKey(parsed) == value;
}

String _text(JsonMap value, String key) {
  final result = value[key];
  if (result is! String || result.trim().isEmpty) {
    throw FormatException('$key tidak valid.');
  }
  return result.trim();
}

int _positiveInt(JsonMap value, String key) {
  final result = value[key];
  if (result is! num || result <= 0) throw FormatException('$key tidak valid.');
  return result.round();
}

DateTime _date(JsonMap value, String key) {
  final result = value[key];
  if (result is! String) throw FormatException('$key tidak valid.');
  final parsed = DateTime.tryParse(result);
  if (parsed == null) throw FormatException('$key tidak valid.');
  return parsed;
}
