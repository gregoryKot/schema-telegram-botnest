#!/usr/bin/env node
// One-time data migration from Railway to Amvera Postgres
// Runs at container startup, checks if data already exists before inserting

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[migration] DATABASE_URL not set, skipping');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // Check if data already exists
    const result = await client.query('SELECT COUNT(*) FROM "User"');
    const userCount = parseInt(result.rows[0].count, 10);

    if (userCount > 0) {
      console.log(`[migration] Data already present (${userCount} users), skipping Railway import`);
      return;
    }

    console.log('[migration] Empty database detected, importing Railway data...');

    const sqlFile = path.join(__dirname, 'railway_data.sql');
    if (!fs.existsSync(sqlFile)) {
      console.log('[migration] railway_data.sql not found, skipping');
      return;
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by semicolons but preserve multiline values
    // Execute the whole file as one transaction
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('[migration] Railway data imported successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[migration] Import failed, rolled back:', err.message);
    }

  } catch (err) {
    console.error('[migration] Connection error:', err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
