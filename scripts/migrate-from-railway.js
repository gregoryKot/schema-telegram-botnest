#!/usr/bin/env node
// One-time data migration: reads from Railway Postgres, writes to Amvera Postgres
// Runs at container startup; skips if data already exists

const { Client } = require('pg');

// Tables in FK-safe insertion order (parents before children)
const TABLES = [
  'User',
  'Pair',
  'TherapyRelation',
  'AuthProvider',
  'WebSession',
  'AppActivity',
  'ChildhoodRating',
  'ClientConceptualization',
  'GratitudeDiaryEntry',
  'ModeDiaryEntry',
  'Note',
  'PracticePlan',
  'Rating',
  'ScheduledNotification',
  'SchemaDiaryEntry',
  'TherapistNote',
  'UserModeNote',
  'UserPractice',
  'UserSafePlace',
  'UserSchemaNote',
  'UserTask',
  'UserBeliefCheck',
  'UserFlashcard',
  'UserLetter',
  'YsqProgress',
  'YsqResult',
  'YsqResultHistory',
];

async function copyTable(src, dst, table) {
  const { rows } = await src.query(`SELECT * FROM "${table}"`);
  if (rows.length === 0) return 0;

  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(', ');

  let inserted = 0;
  for (const row of rows) {
    const values = cols.map(c => {
      const v = row[c];
      // pg returns jsonb as parsed JS objects; pass them as-is and pg will re-serialize
      return v;
    });
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    try {
      await dst.query(
        `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values,
      );
      inserted++;
    } catch (err) {
      console.error(`[migration] Row error in ${table}: ${err.message}`);
    }
  }
  return inserted;
}

async function main() {
  const railwayUrl = process.env.RAILWAY_DATABASE_URL;
  const amveraUrl  = process.env.DATABASE_URL;

  if (!railwayUrl) {
    console.log('[migration] RAILWAY_DATABASE_URL not set, skipping');
    return;
  }
  if (!amveraUrl) {
    console.log('[migration] DATABASE_URL not set, skipping');
    return;
  }

  const src = new Client({ connectionString: railwayUrl, ssl: { rejectUnauthorized: false } });
  const dst = new Client({ connectionString: amveraUrl });

  try {
    await src.connect();
    await dst.connect();

    // Check if already migrated
    const check = await dst.query('SELECT COUNT(*) FROM "User"');
    const existing = parseInt(check.rows[0].count, 10);
    if (existing > 0) {
      console.log(`[migration] Already have ${existing} users, skipping`);
      return;
    }

    console.log('[migration] Empty DB — starting Railway → Amvera copy...');

    let total = 0;
    for (const table of TABLES) {
      try {
        const n = await copyTable(src, dst, table);
        console.log(`[migration]   ${table}: ${n} rows`);
        total += n;
      } catch (err) {
        console.error(`[migration] Table ${table} failed: ${err.message}`);
      }
    }

    console.log(`[migration] Done — ${total} rows copied`);
  } catch (err) {
    console.error('[migration] Fatal error:', err.message);
  } finally {
    await src.end().catch(() => null);
    await dst.end().catch(() => null);
  }
}

main().catch(console.error);
