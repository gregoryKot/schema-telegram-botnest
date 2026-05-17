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

// jsonb / json OIDs in PostgreSQL
const JSON_OIDS = new Set([114, 3802]);

async function copyTable(src, dst, table) {
  const result = await src.query(`SELECT * FROM "${table}"`);
  const { rows, fields } = result;
  if (rows.length === 0) return 0;

  // Detect jsonb/json columns by OID so we can re-serialize them
  const jsonColNames = new Set(
    fields.filter(f => JSON_OIDS.has(f.dataTypeID)).map(f => f.name),
  );

  const cols = fields.map(f => f.name);
  const colList = cols.map(c => `"${c}"`).join(', ');

  let inserted = 0;
  for (const row of rows) {
    const values = cols.map(c => {
      const v = row[c];
      // pg parses jsonb columns into JS values; re-serialize so PostgreSQL
      // receives a valid JSON string (important for encrypted string fields)
      if (jsonColNames.has(c) && v !== null && v !== undefined) {
        return JSON.stringify(v);
      }
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

async function ensureFkUsersExist(src, dst) {
  // TherapyRelation.therapistId references User.id; those therapist users
  // may not be regular app users — insert them first.
  const { rows: trRows } = await src.query(`SELECT DISTINCT "therapistId" FROM "TherapyRelation"`);
  const therapistIds = trRows.map(r => r.therapistId);
  if (therapistIds.length === 0) return;

  for (const tid of therapistIds) {
    const check = await dst.query(`SELECT 1 FROM "User" WHERE id = $1`, [tid]);
    if (check.rows.length === 0) {
      // Fetch the full user row from source and insert it
      const result = await src.query(`SELECT * FROM "User" WHERE id = $1`, [tid]);
      if (result.rows.length === 0) {
        console.log(`[migration] Therapist user ${tid} not found in source, skipping`);
        continue;
      }
      const { rows, fields } = result;
      const jsonColNames = new Set(fields.filter(f => JSON_OIDS.has(f.dataTypeID)).map(f => f.name));
      const cols = fields.map(f => f.name);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const values = cols.map(c => {
        const v = rows[0][c];
        if (jsonColNames.has(c) && v !== null && v !== undefined) return JSON.stringify(v);
        return v;
      });
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      try {
        await dst.query(
          `INSERT INTO "User" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        );
        console.log(`[migration] Inserted missing therapist user ${tid}`);
      } catch (err) {
        console.error(`[migration] Failed to insert therapist user ${tid}: ${err.message}`);
      }
    }
  }
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

    // First pass: copy User table so FK deps are satisfied
    const userCount = await copyTable(src, dst, 'User');
    console.log(`[migration]   User: ${userCount} rows`);

    // Ensure any therapist users referenced by TherapyRelation are present
    await ensureFkUsersExist(src, dst);

    let total = userCount;
    for (const table of TABLES.slice(1)) { // skip User, already done
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
