/**
 * Fix script — removes invalid draws from Firestore and re-seeds with only
 * modern Israeli Lotto data: 6 main numbers (1-37) + Hazak strong number (1-7).
 *
 * Run: node scripts/fix-firestore-data.mjs
 * Requires Firestore rules to allow read + delete (temporarily open to read/write).
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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
const BATCH_SIZE = 400;

// Valid modern Israeli Lotto format:
// - 6 main numbers, all within 1-37
// - 1 strong number (Hazak) within 1-7
// - Draw numbers <= 3894 (confirmed max from the regular Lotto CSV sequence)
//   Draws 6801+ are from a different lottery game (different pool 1-49)
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

// ─── Local data parsers (same as seed script) ─────────────────────────────────

function parseCSV(filePath) {
  const results = [];
  try {
    const text = readFileSync(filePath, 'utf8');
    const lines = text.split('\n').filter(Boolean);
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 9) continue;
      const drawNumber = parseInt(cols[0].trim(), 10);
      const rawDate = cols[1].trim();
      if (isNaN(drawNumber) || !rawDate) continue;
      const [dd, mm, yyyy] = rawDate.split('/');
      const isoDate = dd && mm && yyyy
        ? `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
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
    console.warn(`Could not parse ${filePath}: ${e.message}`);
  }
  return results;
}

function parseJSON(filePath) {
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const arr = Array.isArray(raw) ? raw : raw.results ?? [];
    return arr.filter(
      (r) =>
        r.drawNumber && r.date &&
        Array.isArray(r.numbers) && r.numbers.length === 6 &&
        typeof r.bonus === 'number'
    );
  } catch (e) {
    console.warn(`Could not parse ${filePath}: ${e.message}`);
    return [];
  }
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function batchDelete(docRefs) {
  let deleted = 0;
  for (let i = 0; i < docRefs.length; i += BATCH_SIZE) {
    const chunk = docRefs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
    process.stdout.write(`  🗑  ${deleted}/${docRefs.length} deleted\r`);
  }
  process.stdout.write('\n');
}

async function batchWrite(results) {
  let written = 0;
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const chunk = results.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((r) => {
      const ref = doc(db, COLLECTION, String(r.drawNumber));
      batch.set(ref, {
        drawNumber: r.drawNumber,
        date: r.date,
        numbers: r.numbers,
        bonus: r.bonus,
        jackpot: r.jackpot ?? 0,
        addedAt: Timestamp.now(),
      });
    });
    await batch.commit();
    written += chunk.length;
    process.stdout.write(`  ✓  ${written}/${results.length} written\r`);
  }
  process.stdout.write('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Step 1: Load all current Firestore docs ──────────────────────────────
  console.log('📖 Reading all documents from Firestore...');
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('drawNumber', 'asc')));
  const allDocs = snap.docs;
  console.log(`   Found ${allDocs.length} documents total`);

  // ── Step 2: Identify invalid docs ───────────────────────────────────────
  const toDelete = allDocs.filter((d) => !isValidModernDraw(d.data()));
  const validDocs = allDocs.filter((d) => isValidModernDraw(d.data()));

  console.log(`   Valid modern-format draws : ${validDocs.length}`);
  console.log(`   Invalid draws to remove   : ${toDelete.length}`);

  if (toDelete.length > 0) {
    // Show why draws are invalid
    const wrongGame = toDelete.filter((d) => d.data().numbers.some((n) => n > 37));
    const wrongBonus = toDelete.filter((d) => d.data().bonus > 7 && d.data().numbers.every((n) => n <= 37));
    console.log(`     - Wrong game (numbers > 37): ${wrongGame.length}`);
    console.log(`     - Old format (bonus > 7)    : ${wrongBonus.length}`);

    // ── Step 3: Delete invalid docs ────────────────────────────────────────
    console.log('\n🗑  Deleting invalid documents...');
    await batchDelete(toDelete.map((d) => d.ref));
    console.log(`   ✅ Deleted ${toDelete.length} invalid documents`);
  } else {
    console.log('   ✅ No invalid documents found, nothing to delete');
  }

  // ── Step 4: Check if any valid local draws are missing from Firestore ────
  console.log('\n📂 Loading local data files to check for missing valid draws...');
  const csvRoot = parseCSV(join(ROOT, 'Lotto.csv'));
  const csvPublic = parseCSV(join(ROOT, 'public/data/pais-lottery-data.csv'));
  const jsonData = parseJSON(join(ROOT, 'public/data/israeli-lottery-history.json'));

  const map = new Map();
  for (const r of [...csvRoot, ...csvPublic, ...jsonData]) {
    map.set(r.drawNumber, r);
  }
  const allLocal = Array.from(map.values()).filter(isValidModernDraw);
  console.log(`   Valid draws in local files: ${allLocal.length}`);

  const existingDrawNumbers = new Set(validDocs.map((d) => d.data().drawNumber));
  const missing = allLocal.filter((r) => !existingDrawNumbers.has(r.drawNumber));

  if (missing.length > 0) {
    console.log(`\n📝 Writing ${missing.length} missing valid draw(s)...`);
    await batchWrite(missing.sort((a, b) => a.drawNumber - b.drawNumber));
    console.log(`   ✅ Wrote ${missing.length} missing draws`);
  } else {
    console.log('   ✅ All valid local draws already in Firestore');
  }

  // ── Step 5: Summary ───────────────────────────────────────────────────────
  const finalCount = validDocs.length + missing.length;
  const sample = allLocal.filter(isValidModernDraw).sort((a, b) => a.drawNumber - b.drawNumber);
  console.log('\n📊 Final Firestore state:');
  console.log(`   • Valid documents  : ${finalCount}`);
  console.log(`   • Draw range       : #${sample[0]?.drawNumber} → #${sample[sample.length - 1]?.drawNumber}`);
  console.log(`   • Date range       : ${sample[0]?.date} → ${sample[sample.length - 1]?.date}`);
  console.log(`   • Numbers range    : 1–37`);
  console.log(`   • Strong number    : 1–7`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Fix failed:', err.message);
  console.error('   Make sure Firestore rules allow read + delete (temporarily open to read/write).');
  process.exit(1);
});
