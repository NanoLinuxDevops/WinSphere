import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { IsraeliLotteryResult } from './israeliLotteryAPI';

// ─── Constants ─────────────────────────────────────────────────────────────────
const COLLECTION = 'lotto_results';
const SYNC_KEY = 'firebase-last-sync'; // localStorage key
const FIRESTORE_CACHE_KEY = 'firestore-lottery-cache';
const BATCH_SIZE = 500; // Firestore writeBatch limit

// Israel uses Asia/Jerusalem (UTC+2/UTC+3 DST)
const ISRAEL_TZ = 'Asia/Jerusalem';

// Draw happens Saturday night; we consider Saturday 21:30 IST as "draw available"
const DRAW_HOUR = 21;
const DRAW_MINUTE = 30;

// ─── Valid modern format filter ─────────────────────────────────────────────────
// Only keep draws matching the current Israeli Lotto: 6 main numbers (1-37) + Hazak (1-7)
// Draw numbers 6801-9934 belong to a different lottery game (1-49 pool) and are excluded.
const INVALID_DRAW_RANGE_START = 6801;

function isValidModernDraw(r: IsraeliLotteryResult): boolean {
  return (
    typeof r.drawNumber === 'number' &&
    r.drawNumber < INVALID_DRAW_RANGE_START &&
    Array.isArray(r.numbers) &&
    r.numbers.length === 6 &&
    r.numbers.every((n) => n >= 1 && n <= 37) &&
    typeof r.bonus === 'number' &&
    r.bonus >= 1 &&
    r.bonus <= 7
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────────
interface SyncRecord {
  timestamp: string; // ISO string
  latestDrawNumber: number;
}

interface FirestoreCacheEntry {
  data: IsraeliLotteryResult[];
  timestamp: string;
}

// ─── Saturday Detection ─────────────────────────────────────────────────────────

/**
 * Returns the UTC timestamp (ms) of last Saturday's draw in Israel time.
 * If today is Saturday and current Israel time is past DRAW_HOUR:DRAW_MINUTE,
 * "last Saturday" is today; otherwise it's the previous Saturday.
 */
function getLastSaturdayDrawTimestamp(): number {
  const now = new Date();

  // Get current time parts in Israel timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

  const isIsraelSaturday = weekday === 'Sat';
  const isAfterDraw = hour > DRAW_HOUR || (hour === DRAW_HOUR && minute >= DRAW_MINUTE);

  // Build a Date object representing Saturday of the current week at draw time in Israel TZ
  // Day-of-week: Sun=0, Mon=1, ... Sat=6 (JS)
  const dayOfWeek = now.getDay(); // in UTC, but close enough for day math
  const daysUntilLastSat = isIsraelSaturday && isAfterDraw ? 0 : (dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 0 : dayOfWeek + 1);

  // Actually compute last Saturday date properly via Israel TZ
  const israelNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: ISRAEL_TZ })
  );
  const israelDayOfWeek = israelNow.getDay(); // 0=Sun ... 6=Sat

  let daysBack: number;
  if (israelDayOfWeek === 6) {
    // Today is Saturday in Israel
    const pastDraw = israelNow.getHours() > DRAW_HOUR ||
      (israelNow.getHours() === DRAW_HOUR && israelNow.getMinutes() >= DRAW_MINUTE);
    daysBack = pastDraw ? 0 : 7;
  } else {
    // daysBack to previous Saturday: israelDayOfWeek - 6 (mod 7), but Sat=6
    daysBack = (israelDayOfWeek + 1) % 7 === 0 ? 1 : israelDayOfWeek + 1;
    // Simpler: days since last Saturday
    daysBack = israelDayOfWeek === 0 ? 1 : israelDayOfWeek + 1;
  }

  // Build the target date: israelNow minus daysBack days, set to DRAW_HOUR:DRAW_MINUTE in Israel TZ
  const target = new Date(israelNow);
  target.setDate(israelNow.getDate() - daysBack);
  target.setHours(DRAW_HOUR, DRAW_MINUTE, 0, 0);

  // Convert back to UTC ms by using a proper Date in Israel TZ
  // We'll build a locale string and parse it
  const tzOffset = getIsraelUTCOffset(target);
  return target.getTime() - tzOffset * 60 * 1000;
}

/** Returns Israel's UTC offset in minutes at a given moment. */
function getIsraelUTCOffset(date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const ilStr = date.toLocaleString('en-US', { timeZone: ISRAEL_TZ });
  const utcDate = new Date(utcStr);
  const ilDate = new Date(ilStr);
  return Math.round((ilDate.getTime() - utcDate.getTime()) / 60000);
}

/**
 * Returns true if a Saturday sync is needed (i.e. the last recorded sync
 * predates the most recent Saturday draw time in Israel).
 */
export function isSaturdayUpdateNeeded(): boolean {
  const lastSaturdayDrawTs = getLastSaturdayDrawTimestamp();
  const raw = localStorage.getItem(SYNC_KEY);
  if (!raw) return true;

  try {
    const record: SyncRecord = JSON.parse(raw);
    const lastSyncTs = new Date(record.timestamp).getTime();
    return lastSyncTs < lastSaturdayDrawTs;
  } catch {
    return true;
  }
}

// ─── Firestore Reads ────────────────────────────────────────────────────────────

/** Returns the highest drawNumber stored in Firestore (1 read). */
export async function getLatestDrawNumber(): Promise<number> {
  const q = query(
    collection(db, COLLECTION),
    orderBy('drawNumber', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  return (snap.docs[0].data() as IsraeliLotteryResult).drawNumber;
}

/**
 * Fetches all draws from Firestore, sorted newest-first.
 * Result is mirrored to localStorage to avoid redundant reads.
 */
export async function getAllDrawsFromFirestore(): Promise<IsraeliLotteryResult[]> {
  const q = query(collection(db, COLLECTION), orderBy('drawNumber', 'desc'));
  const snap = await getDocs(q);
  const results: IsraeliLotteryResult[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      drawNumber: data.drawNumber,
      date: data.date,
      numbers: data.numbers,
      bonus: data.bonus,
      jackpot: data.jackpot ?? 0,
    };
  });

  // Mirror to localStorage
  const cache: FirestoreCacheEntry = {
    data: results,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(FIRESTORE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage quota — ignore
  }

  return results;
}

/** Returns cached Firestore data from localStorage without any network call. */
export function getCachedFirestoreData(): IsraeliLotteryResult[] | null {
  const raw = localStorage.getItem(FIRESTORE_CACHE_KEY);
  if (!raw) return null;
  try {
    const entry: FirestoreCacheEntry = JSON.parse(raw);
    return entry.data ?? null;
  } catch {
    return null;
  }
}

/** Returns the age of the Firestore localStorage cache in hours, or Infinity if none. */
export function getFirestoreCacheAgeHours(): number {
  const raw = localStorage.getItem(FIRESTORE_CACHE_KEY);
  if (!raw) return Infinity;
  try {
    const entry: FirestoreCacheEntry = JSON.parse(raw);
    const diffMs = Date.now() - new Date(entry.timestamp).getTime();
    return diffMs / (1000 * 60 * 60);
  } catch {
    return Infinity;
  }
}

// ─── Firestore Writes ───────────────────────────────────────────────────────────

/** Writes an array of draws to Firestore in batches of 500. Uses drawNumber as doc ID. */
export async function batchWriteDraws(results: IsraeliLotteryResult[]): Promise<void> {
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const chunk = results.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const result of chunk) {
      const ref = doc(db, COLLECTION, String(result.drawNumber));
      batch.set(ref, {
        drawNumber: result.drawNumber,
        date: result.date,
        numbers: result.numbers,
        bonus: result.bonus,
        jackpot: result.jackpot ?? 0,
        addedAt: Timestamp.now(),
      });
    }

    await batch.commit();
  }
}

// ─── Seeding ────────────────────────────────────────────────────────────────────

/** Parses the bundled CSV (public/data/pais-lottery-data.csv) into IsraeliLotteryResult[]. */
async function parseBundledCSV(): Promise<IsraeliLotteryResult[]> {
  try {
    const response = await fetch('/data/pais-lottery-data.csv');
    if (!response.ok) return [];
    const text = await response.text();
    const lines = text.split('\n').filter(Boolean);
    // Skip header row (index 0 — may be Hebrew or English)
    const results: IsraeliLotteryResult[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 9) continue;

      const drawNumber = parseInt(cols[0].trim(), 10);
      const rawDate = cols[1].trim(); // DD/MM/YYYY

      if (isNaN(drawNumber) || !rawDate) continue;

      // Convert DD/MM/YYYY → YYYY-MM-DD
      const dateParts = rawDate.split('/');
      let isoDate = rawDate;
      if (dateParts.length === 3) {
        isoDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
      }

      const numbers: number[] = [];
      for (let n = 2; n <= 7; n++) {
        const num = parseInt(cols[n].trim(), 10);
        if (!isNaN(num)) numbers.push(num);
      }
      if (numbers.length !== 6) continue;

      const bonus = parseInt(cols[8].trim(), 10);
      if (isNaN(bonus)) continue;

      results.push({ drawNumber, date: isoDate, numbers, bonus, jackpot: 0 });
    }

    return results;
  } catch {
    return [];
  }
}

/** Parses the bundled JSON (public/data/israeli-lottery-history.json). */
async function parseBundledJSON(): Promise<IsraeliLotteryResult[]> {
  try {
    const response = await fetch('/data/israeli-lottery-history.json');
    if (!response.ok) return [];
    const json = await response.json();
    const raw: IsraeliLotteryResult[] = Array.isArray(json) ? json : json.results ?? [];
    return raw.filter(
      (r) =>
        r.drawNumber &&
        r.date &&
        Array.isArray(r.numbers) &&
        r.numbers.length === 6 &&
        typeof r.bonus === 'number'
    );
  } catch {
    return [];
  }
}

/**
 * Seeds all historical data into Firestore on first launch.
 * Merges JSON + CSV, deduplicates by drawNumber. No-op if Firestore already has data.
 */
export async function seedHistoricalDataIfEmpty(): Promise<void> {
  const latest = await getLatestDrawNumber();
  if (latest > 0) {
    console.log(`✅ Firestore already seeded (latest draw: ${latest})`);
    return;
  }

  console.log('🌱 Seeding historical lottery data into Firestore...');

  const [jsonData, csvData] = await Promise.all([parseBundledJSON(), parseBundledCSV()]);

  // Merge, deduplicate by drawNumber, and keep only valid modern format draws
  const map = new Map<number, IsraeliLotteryResult>();
  for (const r of [...csvData, ...jsonData]) {
    map.set(r.drawNumber, r); // JSON wins on conflict (more reliable format)
  }

  const allResults = Array.from(map.values())
    .filter(isValidModernDraw)
    .sort((a, b) => a.drawNumber - b.drawNumber);

  if (allResults.length === 0) {
    console.warn('⚠️ No historical data found to seed');
    return;
  }

  await batchWriteDraws(allResults);
  console.log(`✅ Seeded ${allResults.length} historical draws into Firestore`);
}

// ─── Saturday Sync ──────────────────────────────────────────────────────────────

/**
 * Main entry point. Call this on app mount.
 *
 * Strategy (minimise Firestore reads):
 *  1. If Firestore localStorage cache is < 24h old AND no Saturday update needed → return cache (0 reads).
 *  2. If Firestore is empty → seed historical data, return seeded data.
 *  3. If Saturday update window → 1 read (latest drawNumber), compare to external source,
 *     write only missing draws, then return all data from cache.
 *  4. Otherwise → 1 full read (getAllDrawsFromFirestore), update localStorage mirror.
 */
export async function syncIfNeeded(
  fetchLatestFromNetwork?: () => Promise<IsraeliLotteryResult[]>
): Promise<IsraeliLotteryResult[]> {
  const cacheAge = getFirestoreCacheAgeHours();
  const saturdayUpdate = isSaturdayUpdateNeeded();

  // Fast path: recent cache, no Saturday update needed
  if (cacheAge < 24 && !saturdayUpdate) {
    const cached = getCachedFirestoreData();
    if (cached && cached.length > 0) {
      console.log('⚡ Serving from Firestore localStorage cache (no sync needed)');
      return cached;
    }
  }

  // Check if Firestore is empty → seed first
  const latest = await getLatestDrawNumber();
  if (latest === 0) {
    await seedHistoricalDataIfEmpty();
    return getAllDrawsFromFirestore();
  }

  // Saturday update: check if we have the newest draw
  if (saturdayUpdate && fetchLatestFromNetwork) {
    console.log('📅 Saturday update window detected — checking for new draws...');
    try {
      const networkData = await fetchLatestFromNetwork();

      if (networkData.length > 0) {
        // Only consider valid modern-format draws from the network
        const validNetwork = networkData.filter(isValidModernDraw);
        if (validNetwork.length > 0) {
          const networkLatest = Math.max(...validNetwork.map((r) => r.drawNumber));

          if (networkLatest > latest) {
            // Write only draws that are newer than what Firestore has
            const newDraws = validNetwork.filter((r) => r.drawNumber > latest);
            console.log(`📝 Writing ${newDraws.length} new draw(s) to Firestore...`);
            await batchWriteDraws(newDraws);
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Saturday network fetch failed, using existing Firestore data', err);
    }

    // Record sync time
    const raw = localStorage.getItem(SYNC_KEY);
    const syncRecord: SyncRecord = {
      timestamp: new Date().toISOString(),
      latestDrawNumber: latest,
    };
    // Update latestDrawNumber if we wrote new draws
    try {
      const existing: SyncRecord = raw ? JSON.parse(raw) : syncRecord;
      syncRecord.latestDrawNumber = Math.max(existing.latestDrawNumber, latest);
    } catch { /* ignore */ }
    localStorage.setItem(SYNC_KEY, JSON.stringify(syncRecord));
  }

  // Full read from Firestore (also refreshes localStorage mirror)
  return getAllDrawsFromFirestore();
}

/** Updates the sync record after a successful sync. */
export function markSyncComplete(latestDrawNumber: number): void {
  const record: SyncRecord = {
    timestamp: new Date().toISOString(),
    latestDrawNumber,
  };
  localStorage.setItem(SYNC_KEY, JSON.stringify(record));
}
