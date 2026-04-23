/**
 * One-time seed script — writes all historical lottery results to Firestore.
 * Run: node scripts/seed-firestore.mjs
 *
 * Prerequisites:
 *  - node >= 18 (native fetch + ES modules)
 *  - npm install already done (firebase package in node_modules)
 *  - Firestore database created in test mode (or rules allow writes)
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Firebase Config ─────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyCFtqm4hXc-DuORmj5oNrvlY4ZY_bzxKG8',
  authDomain: 'winsphere-e664b.firebaseapp.com',
  projectId: 'winsphere-e664b',
  storageBucket: 'winsphere-e664b.firebasestorage.app',
  messagingSenderId: '206752214333',
  appId: '1:206752214333:web:778f72cd490005b369a954',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTION = 'lotto_results';
const BATCH_SIZE = 400; // stay safely under Firestore's 500-op limit

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const results = [];
  try {
    const text = readFileSync(filePath, 'utf8');
    const lines = text.split('\n').filter(Boolean);
    // Skip header row (index 0 — Hebrew or English)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 9) continue;

      const drawNumber = parseInt(cols[0].trim(), 10);
      const rawDate = cols[1].trim(); // DD/MM/YYYY
      if (isNaN(drawNumber) || !rawDate) continue;

      // Convert DD/MM/YYYY → YYYY-MM-DD
      const [dd, mm, yyyy] = rawDate.split('/');
      const isoDate =
        dd && mm && yyyy
          ? `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
          : rawDate;

      const numbers = [];
      for (let n = 2; n <= 7; n++) {
        const num = parseInt(cols[n].trim(), 10);
        if (!isNaN(num)) numbers.push(num);
      }
      if (numbers.length !== 6) continue;

      const bonus = parseInt(cols[8].trim(), 10);
      if (isNaN(bonus)) continue;

      results.push({ drawNumber, date: isoDate, numbers, bonus, jackpot: 0 });
    }
  } catch (e) {
    console.warn(`⚠️  Could not parse ${filePath}: ${e.message}`);
  }
  return results;
}

function parseJSON(filePath) {
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const arr = Array.isArray(raw) ? raw : raw.results ?? [];
    return arr.filter(
      (r) =>
        r.drawNumber &&
        r.date &&
        Array.isArray(r.numbers) &&
        r.numbers.length === 6 &&
        typeof r.bonus === 'number'
    );
  } catch (e) {
    console.warn(`⚠️  Could not parse ${filePath}: ${e.message}`);
    return [];
  }
}

// ─── Merge & Deduplicate ──────────────────────────────────────────────────────

function mergeAndDeduplicate(...datasets) {
  const map = new Map();
  for (const dataset of datasets) {
    for (const r of dataset) {
      map.set(r.drawNumber, r); // later datasets win (JSON is most reliable)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.drawNumber - b.drawNumber);
}

// ─── Firestore Helpers ────────────────────────────────────────────────────────

async function getLatestDrawInFirestore() {
  const q = query(collection(db, COLLECTION), orderBy('drawNumber', 'desc'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  return snap.docs[0].data().drawNumber;
}

async function batchWrite(results) {
  let written = 0;
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const chunk = results.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const r of chunk) {
      const ref = doc(db, COLLECTION, String(r.drawNumber));
      batch.set(ref, {
        drawNumber: r.drawNumber,
        date: r.date,
        numbers: r.numbers,
        bonus: r.bonus,
        jackpot: r.jackpot ?? 0,
        addedAt: Timestamp.now(),
      });
    }
    await batch.commit();
    written += chunk.length;
    process.stdout.write(`  ✓ ${written}/${results.length} documents written\r`);
  }
  process.stdout.write('\n');
}

// ─── Valid modern format filter ───────────────────────────────────────────────

// Only keep draws matching the current Israeli Lotto format:
//   6 main numbers (1-37) + 1 Hazak strong number (1-7)
// Draw numbers 6801+ are a different game (1-49 pool) — excluded.
const MAX_REGULAR_LOTTO_DRAW = 3894;

function isValidModernDraw(r) {
  return (
    typeof r.drawNumber === 'number' &&
    r.drawNumber <= MAX_REGULAR_LOTTO_DRAW &&
    Array.isArray(r.numbers) &&
    r.numbers.length === 6 &&
    r.numbers.every((n) => n >= 1 && n <= 37) &&
    typeof r.bonus === 'number' &&
    r.bonus >= 1 &&
    r.bonus <= 7
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Loading historical data from local files...');

  const csvRoot = parseCSV(join(ROOT, 'Lotto.csv'));
  const csvPublic = parseCSV(join(ROOT, 'public/data/pais-lottery-data.csv'));
  const jsonData = parseJSON(join(ROOT, 'public/data/israeli-lottery-history.json'));

  console.log(
    `   Lotto.csv: ${csvRoot.length} draws | pais-lottery-data.csv: ${csvPublic.length} draws | JSON: ${jsonData.length} draws`
  );

  // JSON overrides CSV for the same drawNumber (JSON is cleaner format)
  // Filter to only valid modern Israeli Lotto format (1-37 + Hazak 1-7)
  const allResults = mergeAndDeduplicate(csvRoot, csvPublic, jsonData).filter(isValidModernDraw);
  console.log(`   Merged + filtered (modern format only): ${allResults.length} unique draws`);

  console.log('\n🔌 Checking Firestore...');
  const latestInDB = await getLatestDrawInFirestore();

  if (latestInDB === 0) {
    console.log('   Firestore is empty — seeding all data...\n');
    await batchWrite(allResults);
    console.log(`\n✅ Done! ${allResults.length} draws written to Firestore.`);
  } else {
    // Only write draws newer than what's already in Firestore
    const missing = allResults.filter((r) => r.drawNumber > latestInDB);
    if (missing.length === 0) {
      console.log(
        `   Firestore already has all data (latest draw: #${latestInDB}). Nothing to write.`
      );
    } else {
      console.log(
        `   Firestore latest draw: #${latestInDB}. Writing ${missing.length} missing draw(s)...\n`
      );
      await batchWrite(missing);
      console.log(`\n✅ Done! ${missing.length} new draw(s) written to Firestore.`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   • Total draws in local files: ${allResults.length}`);
  console.log(`   • Date range: ${allResults[0].date} → ${allResults[allResults.length - 1].date}`);
  console.log(`   • Draw numbers: #${allResults[0].drawNumber} → #${allResults[allResults.length - 1].drawNumber}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
