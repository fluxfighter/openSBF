import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { UserProgress } from '@/lib/types';

// Server-side, single-user JSON persistence. One file holds the whole
// UserProgress object so the same learning state is shared across devices
// (phone + desktop) on the home network. No database, no auth — by design.

const DATA_DIR = process.env.OPENSBF_DATA_DIR ?? path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'progress.json');

function isUserProgress(value: unknown): value is UserProgress {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.questions === 'object' && v.questions !== null;
}

export async function readState(): Promise<UserProgress | null> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isUserProgress(parsed)) return null;
    if (!parsed.pruefungsboegen) parsed.pruefungsboegen = {};
    if (!parsed.bookmarks) parsed.bookmarks = {};
    return parsed;
  } catch {
    // Missing file or invalid JSON → treat as "no state yet".
    return null;
  }
}

export async function writeState(progress: UserProgress): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Write atomically: write to a temp file, then rename over the target so a
  // crash mid-write can never leave a half-written progress file.
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(progress), 'utf8');
  await fs.rename(tmp, STATE_FILE);
}
