#!/usr/bin/env node
// Fix incomplete migration — inserts only rows that failed the first run.
// Safe to re-run: all inserts use ON CONFLICT DO NOTHING.

const { Client } = require('pg');

const JSON_OIDS = new Set([114, 3802]);

const FAILED_TABLES = [
  'User',           // 1 row failed due to JSON type error
  'TherapyRelation',
  'ClientConceptualization',
  'GratitudeDiaryEntry',
  'Note',
  'ScheduledNotification',
  'SchemaDiaryEntry',
  'UserModeNote',
  'UserSchemaNote',
  'YsqProgress',
  'YsqResult',
  'YsqResultHistory',
];

async function copyTable(src, dst, table) {
  const result = await src.query(`SELECT * FROM "${table}"`);
  const { rows, fields } = result;
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  const jsonColNames = new Set(
    fields.filter(f => JSON_OIDS.has(f.dataTypeID)).map(f => f.name),
  );
  const cols = fields.map(f => f.name);
  const colList = cols.map(c => `"${c}"`).join(', ');

  let inserted = 0, skipped = 0;
  for (const row of rows) {
    const values = cols.map(c => {
      const v = row[c];
      if (jsonColNames.has(c) && v !== null && v !== undefined) {
        return JSON.stringify(v);
      }
      return v;
    });
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    try {
      const res = await dst.query(
        `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values,
      );
      if (res.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`[fix] Row error in ${table}: ${err.message}`);
      skipped++;
    }
  }
  return { inserted, skipped };
}

async function ensureTherapistUsers(src, dst) {
  const { rows: trRows } = await src.query(`SELECT DISTINCT "therapistId" FROM "TherapyRelation"`);
  const therapistIds = trRows.map(r => r.therapistId);

  for (const tid of therapistIds) {
    const check = await dst.query(`SELECT 1 FROM "User" WHERE id = $1`, [tid]);
    if (check.rows.length > 0) continue;

    const result = await src.query(`SELECT * FROM "User" WHERE id = $1`, [tid]);
    if (result.rows.length === 0) {
      console.log(`[fix] Therapist user ${tid} not found in source`);
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
      console.log(`[fix] Inserted missing therapist user ${tid}`);
    } catch (err) {
      console.error(`[fix] Failed to insert therapist user ${tid}: ${err.message}`);
    }
  }
}

async function main() {
  const railwayUrl = process.env.RAILWAY_DATABASE_URL;
  const amveraUrl  = process.env.DATABASE_URL;

  if (!railwayUrl || !amveraUrl) {
    console.error('[fix] Need both RAILWAY_DATABASE_URL and DATABASE_URL');
    process.exit(1);
  }

  const src = new Client({ connectionString: railwayUrl, ssl: { rejectUnauthorized: false } });
  const dst = new Client({ connectionString: amveraUrl });

  try {
    await src.connect();
    await dst.connect();

    // Ensure therapist users exist before TherapyRelation insert
    await ensureTherapistUsers(src, dst);

    let totalInserted = 0;
    for (const table of FAILED_TABLES) {
      const { inserted, skipped } = await copyTable(src, dst, table);
      console.log(`[fix]   ${table}: +${inserted} new rows (${skipped} already existed or errored)`);
      totalInserted += inserted;
    }

    console.log(`[fix] Done — ${totalInserted} new rows inserted`);

    // Final counts
    const tables = ['User', 'TherapyRelation', 'GratitudeDiaryEntry', 'ClientConceptualization',
                    'SchemaDiaryEntry', 'YsqProgress', 'YsqResult', 'YsqResultHistory',
                    'ScheduledNotification', 'Note'];
    console.log('\n[fix] Final counts in Amvera:');
    for (const t of tables) {
      const { rows } = await dst.query(`SELECT COUNT(*) FROM "${t}"`);
      console.log(`  ${t}: ${rows[0].count}`);
    }
  } catch (err) {
    console.error('[fix] Fatal error:', err.message);
  } finally {
    await src.end().catch(() => null);
    await dst.end().catch(() => null);
  }
}

main().catch(console.error);
