const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

async function query(sql, params = []) {
  return getPool().query(sql, params);
}

async function all(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

async function get(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

async function run(sql, params = []) {
  const result = await query(sql, params);
  return { lastID: result.rows[0]?.id || null, changes: result.rowCount };
}

module.exports = { getPool, query, all, get, run };
