import { NextResponse } from 'next/server';
import { readState, writeState } from '@/lib/db';
import { mergeProgress } from '@/lib/progress';
import type { UserProgress } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUserProgress(value: unknown): value is UserProgress {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.questions === 'object' && v.questions !== null;
}

function emptyProgress(): UserProgress {
  return { questions: {}, topics: {}, pruefungsboegen: {}, lastUpdated: new Date().toISOString() };
}

export async function GET(): Promise<NextResponse> {
  const state = await readState();
  return NextResponse.json(state ?? emptyProgress());
}

export async function PUT(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!isUserProgress(body)) {
    return NextResponse.json({ error: 'invalid progress payload' }, { status: 400 });
  }

  // Merge the incoming client state with whatever is on disk so concurrent
  // devices never overwrite each other's answers (max correct/wrong counts win).
  const existing = await readState();
  const merged = existing ? mergeProgress(existing, body) : body;
  await writeState(merged);
  return NextResponse.json(merged);
}
