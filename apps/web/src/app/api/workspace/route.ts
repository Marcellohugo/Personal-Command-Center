import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import {
  createEmptyWorkspace,
  loadWorkspace,
  type OfflineWorkspace
} from "@/lib/offline-workspace";
import { formatDateInput } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { requestHasSession } from "@/lib/session";
import { mergeWorkspaceByRecord } from "@/lib/server-workspace";

async function legacyWorkspace(userId: string): Promise<OfflineWorkspace> {
  const [user, schedules, expenses, notes, habits] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { monthlyBudget: true } }),
    prisma.schedule.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
    prisma.expense.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.note.findMany({ where: { userId }, orderBy: [{ updatedAt: "desc" }] }),
    prisma.habit.findMany({ where: { userId }, include: { logs: true }, orderBy: [{ createdAt: "asc" }] })
  ]);

  const categoryIds = new Map(Array.from(new Set(expenses.map(({ category }) => category))).map((name, index) => [name, `legacy-category-${index}`]));
  const categories = Array.from(categoryIds, ([name, id]) => ({
    id,
    name,
    kind: "expense" as const
  }));

  return {
    ...createEmptyWorkspace(),
    updatedAt: new Date().toISOString(),
    categoryGroups: categories,
    settings: {
      monthlyBudget: user?.monthlyBudget ?? 0,
      hideBalances: false,
      notificationsEnabled: false,
      deletedGoogleEventIds: []
    },
    notes: notes.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      pinned: note.pinned,
      updatedAt: note.updatedAt.toISOString(),
      folder: "",
      tags: []
    })),
    habits: habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      completedDates: Array.from(new Set(habit.logs.map((log) => log.completedAt.toISOString().slice(0, 10)))).sort(),
      createdAt: habit.createdAt.toISOString()
    })),
    schedules: schedules.map((schedule) => ({
      id: schedule.id,
      title: schedule.title,
      description: schedule.description ?? "",
      date: formatDateInput(schedule.date),
      startTime: schedule.startTime,
      endTime: schedule.endTime ?? "",
      location: schedule.location ?? "",
      status: "planned" as const,
      recurrence: "none" as const,
      reminderMinutes: 0
    })),
    transactions: expenses.map((expense) => ({
      id: expense.id,
      kind: "expense" as const,
      amount: expense.amount,
      date: formatDateInput(expense.date),
      sourceId: "",
      categoryId: categoryIds.get(expense.category),
      note: expense.note ?? expense.category,
      createdAt: expense.createdAt.toISOString()
    }))
  };
}

export async function GET(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const user = await requireCurrentUser();
  const snapshot = await prisma.workspaceSnapshot.findUnique({ where: { userId: user.id } });
  const data = snapshot ? loadWorkspace(JSON.stringify(snapshot.data)) : await legacyWorkspace(user.id);

  return NextResponse.json({
    data,
    revision: snapshot?.revision ?? 0,
    generation: snapshot?.generation ?? 1,
    updatedAt: snapshot?.updatedAt.toISOString() ?? data.updatedAt,
    exists: Boolean(snapshot)
  });
}

export async function PUT(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const user = await requireCurrentUser();
  const body = await request.json().catch(() => null) as { data?: unknown; baseData?: unknown; baseRevision?: unknown; force?: unknown } | null;

  if (!body || !body.data || typeof body.baseRevision !== "number" || !Number.isInteger(body.baseRevision) || body.baseRevision < 0) {
    return NextResponse.json({ error: "Payload workspace tidak valid." }, { status: 400 });
  }

  const current = await prisma.workspaceSnapshot.findUnique({ where: { userId: user.id } });
  const localData = loadWorkspace(JSON.stringify(body.data));
  if (current && !body.force && current.revision !== body.baseRevision) {
    if (body.baseData) {
      const baseData = loadWorkspace(JSON.stringify(body.baseData));
      const merge = mergeWorkspaceByRecord(baseData, localData, loadWorkspace(JSON.stringify(current.data)));
      const saved = await prisma.workspaceSnapshot.updateMany({ where: { userId: user.id, revision: current.revision }, data: { data: JSON.parse(JSON.stringify(merge.workspace)), revision: { increment: 1 } } });
      if (!saved.count) return NextResponse.json({ error: "Workspace berubah lagi. Coba sinkronkan ulang." }, { status: 409 });
      const snapshot = await prisma.workspaceSnapshot.findUniqueOrThrow({ where: { userId: user.id } });
      return NextResponse.json({ data: merge.workspace, revision: snapshot.revision, generation: snapshot.generation, updatedAt: snapshot.updatedAt.toISOString(), exists: true, conflicts: merge.conflicts }, { status: merge.conflicts.length ? 409 : 200 });
    }
    return NextResponse.json({ error: "Workspace berubah di perangkat lain.", data: loadWorkspace(JSON.stringify(current.data)), revision: current.revision, updatedAt: current.updatedAt.toISOString() }, { status: 409 });
  }

  const data = localData;
  const jsonData = JSON.parse(JSON.stringify(data));
  if (current) {
    const updated = await prisma.workspaceSnapshot.updateMany({
      where: { userId: user.id, revision: current.revision },
      data: { data: jsonData, revision: { increment: 1 } }
    });
    if (updated.count === 0) {
      const latest = await prisma.workspaceSnapshot.findUniqueOrThrow({ where: { userId: user.id } });
      return NextResponse.json({
        error: "Workspace berubah di perangkat lain.",
        data: loadWorkspace(JSON.stringify(latest.data)),
        revision: latest.revision,
        generation: latest.generation,
        updatedAt: latest.updatedAt.toISOString()
      }, { status: 409 });
    }
  } else {
    try {
      await prisma.workspaceSnapshot.create({ data: { userId: user.id, data: jsonData, revision: 1 } });
    } catch (error) {
      const latest = await prisma.workspaceSnapshot.findUnique({ where: { userId: user.id } });
      if (!latest) throw error;
      return NextResponse.json({
        error: "Workspace dibuat lebih dulu di perangkat lain.",
        data: loadWorkspace(JSON.stringify(latest.data)),
        revision: latest.revision,
        updatedAt: latest.updatedAt.toISOString()
      }, { status: 409 });
    }
  }

  const snapshot = await prisma.workspaceSnapshot.findUniqueOrThrow({ where: { userId: user.id } });

  return NextResponse.json({
    data,
    revision: snapshot.revision,
    generation: snapshot.generation,
    updatedAt: snapshot.updatedAt.toISOString(),
    exists: true
  });
}

export async function DELETE(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const user = await requireCurrentUser();
  const snapshot = await prisma.workspaceSnapshot.findUnique({ where: { userId: user.id } });
  const nextGeneration = (snapshot?.generation ?? 1) + 1;
  const empty = createEmptyWorkspace();
  if (snapshot) {
    await prisma.workspaceSnapshot.update({ where: { userId: user.id }, data: { data: JSON.parse(JSON.stringify(empty)), revision: { increment: 1 }, generation: nextGeneration } });
  } else {
    await prisma.workspaceSnapshot.create({ data: { userId: user.id, data: JSON.parse(JSON.stringify(empty)), revision: 1, generation: nextGeneration } });
  }
  await Promise.all([
    prisma.workspaceItem.deleteMany({ where: { userId: user.id } }).catch(() => null),
    prisma.workspaceChange.deleteMany({ where: { userId: user.id } }).catch(() => null),
    prisma.workspaceConflict.deleteMany({ where: { userId: user.id } }).catch(() => null)
  ]);
  return NextResponse.json({ ok: true, generation: nextGeneration, data: empty });
}
