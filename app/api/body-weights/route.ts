import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/db';
import { OWNER_AUTH_SUBJECT } from '@/src/server/appStateStore';
import { normalizeBodyWeightEntry } from '@/src/utils/bodyWeight';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const entries = await prisma.bodyWeightEntry.findMany({ where: { owner: { authSubject: OWNER_AUTH_SUBJECT } }, orderBy: { date: 'asc' } });
    return NextResponse.json({ version: 1, entries: entries.map((entry) => ({
      schemaVersion: 1, id: entry.legacyId || entry.id, date: entry.date.toISOString().slice(0, 10),
      weightKg: entry.weightKg.toNumber(), sourceValue: entry.sourceValue.toNumber(), sourceUnit: entry.sourceUnit,
    })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load weights.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const entry = normalizeBodyWeightEntry(await request.json().catch(() => null));
  if (!entry || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(Date.parse(entry.date))) {
    return NextResponse.json({ error: 'Invalid weigh-in.' }, { status: 400 });
  }
  try {
    await prisma.$transaction(async (db) => {
      const owner = await db.user.upsert({ where: { authSubject: OWNER_AUTH_SUBJECT }, create: { authSubject: OWNER_AUTH_SUBJECT, role: 'CLIENT' }, update: {} });
      await db.bodyWeightEntry.deleteMany({ where: { ownerId: owner.id, date: new Date(entry.date) } });
      await db.bodyWeightEntry.upsert({
        where: { ownerId_legacyId: { ownerId: owner.id, legacyId: entry.id } },
        create: { ownerId: owner.id, legacyId: entry.id, date: new Date(entry.date), weightKg: entry.weightKg, sourceValue: entry.sourceValue, sourceUnit: entry.sourceUnit },
        update: { date: new Date(entry.date), weightKg: entry.weightKg, sourceValue: entry.sourceValue, sourceUnit: entry.sourceUnit },
      });
    });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: 'Weight not saved.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Missing weight id.' }, { status: 400 });
  try {
    await prisma.bodyWeightEntry.deleteMany({ where: { owner: { authSubject: OWNER_AUTH_SUBJECT }, OR: [{ legacyId: body.id }, ...(/^[0-9a-f-]{36}$/i.test(body.id) ? [{ id: body.id }] : [])] } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'Weight not deleted.' }, { status: 503 });
  }
}
