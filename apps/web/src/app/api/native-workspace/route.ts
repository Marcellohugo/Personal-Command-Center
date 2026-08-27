import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { loadWorkspace } from "@/lib/offline-workspace";
import { mergeNativeWorkspace, nativeFromWorkspace, normalizeNativeWorkspace } from "@/lib/native-workspace";
import { prisma } from "@/lib/prisma";
import { requestHasSession } from "@/lib/session";

async function currentSnapshot() {
  const user = await requireCurrentUser();
  const snapshot = await prisma.workspaceSnapshot.findUnique({ where: { userId: user.id } });
  return { user, snapshot, workspace: snapshot ? loadWorkspace(JSON.stringify(snapshot.data)) : null };
}

function response(data: ReturnType<typeof nativeFromWorkspace>, revision: number, updatedAt: Date | string, exists = true) {
  return NextResponse.json({ data, revision, updatedAt: new Date(updatedAt).toISOString(), exists });
}

export async function GET(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const { snapshot, workspace } = await currentSnapshot();
  return response(nativeFromWorkspace(workspace ?? loadWorkspace("{}")), snapshot?.revision ?? 0, snapshot?.updatedAt ?? new Date(0), Boolean(snapshot));
}

export async function PUT(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const serialized = await request.text();
  if (serialized.length > 2_000_000) return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });
  const body = (() => { try { return JSON.parse(serialized) as Record<string, unknown>; } catch { return null; } })();
  const data = normalizeNativeWorkspace(body?.data);
  const baseRevision = body?.baseRevision;
  const force = body?.force === true;
  if (!data || typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) {
    return NextResponse.json({ error: "Payload sinkronisasi tidak valid." }, { status: 400 });
  }

  const { user, snapshot, workspace } = await currentSnapshot();
  if (snapshot && !force && snapshot.revision !== baseRevision) {
    return NextResponse.json({ data: nativeFromWorkspace(workspace!), revision: snapshot.revision, updatedAt: snapshot.updatedAt.toISOString(), exists: true, error: "Data berubah di perangkat lain." }, { status: 409 });
  }

  const merged = mergeNativeWorkspace(data, workspace);
  const jsonData = JSON.parse(JSON.stringify(merged));
  if (snapshot) {
    if (force) {
      await prisma.workspaceSnapshot.update({ where: { userId: user.id }, data: { data: jsonData, revision: { increment: 1 } } });
    } else {
      const updated = await prisma.workspaceSnapshot.updateMany({
        where: { userId: user.id, revision: snapshot.revision },
        data: { data: jsonData, revision: { increment: 1 } }
      });
      if (updated.count === 0) {
        const latest = await prisma.workspaceSnapshot.findUniqueOrThrow({ where: { userId: user.id } });
        const latestWorkspace = loadWorkspace(JSON.stringify(latest.data));
        return NextResponse.json({ data: nativeFromWorkspace(latestWorkspace), revision: latest.revision, updatedAt: latest.updatedAt.toISOString(), exists: true, error: "Data berubah di perangkat lain." }, { status: 409 });
      }
    }
  } else {
    try {
      await prisma.workspaceSnapshot.create({ data: { userId: user.id, data: jsonData, revision: 1 } });
    } catch (error) {
      const latest = await prisma.workspaceSnapshot.findUnique({ where: { userId: user.id } });
      if (!latest) throw error;
      const latestWorkspace = loadWorkspace(JSON.stringify(latest.data));
      return NextResponse.json({ data: nativeFromWorkspace(latestWorkspace), revision: latest.revision, updatedAt: latest.updatedAt.toISOString(), exists: true, error: "Data dibuat lebih dulu di perangkat lain." }, { status: 409 });
    }
  }
  const saved = await prisma.workspaceSnapshot.findUniqueOrThrow({ where: { userId: user.id } });
  return response(nativeFromWorkspace(merged), saved.revision, saved.updatedAt);
}
