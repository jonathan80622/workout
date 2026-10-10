import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// Dev-only state bridge for end-to-end runs (see e2e/jev-use). The browser under
// test loads `seed.json` from E2E_STATE_DIR and writes every state change to
// `state.json`, which the test oracle reads. Disabled unless E2E_STATE_DIR is
// set, and always disabled in production builds.
function stateDir(): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  return process.env.E2E_STATE_DIR || null;
}

const notFound = () => NextResponse.json({ error: 'Not found.' }, { status: 404 });

export async function GET() {
  const dir = stateDir();
  if (!dir) return notFound();

  const raw = await fs.readFile(path.join(dir, 'seed.json'), 'utf8').catch(() => null);
  if (raw === null) return NextResponse.json({ error: 'No seed.json in E2E_STATE_DIR.' }, { status: 404 });

  return new NextResponse(raw, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function PUT(request: Request) {
  const dir = stateDir();
  if (!dir) return notFound();

  const state = await request.json().catch(() => null);
  if (!state || typeof state !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object.' }, { status: 400 });
  }

  // Write then rename so the oracle never reads a half-written file.
  const target = path.join(dir, 'state.json');
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2));
  await fs.rename(temp, target);
  return new NextResponse(null, { status: 204 });
}
