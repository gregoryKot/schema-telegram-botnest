'use strict';
// DATABASE_URL → переменные libpq (PGHOST/PGUSER/PGPASSWORD/…).
//
// Зачем: `pg_dump "$DATABASE_URL"` кладёт пароль БД в командную строку
// процесса (виден в /proc/<pid>/cmdline и в `ps`) — пункт D-2 аудита. libpq
// те же параметры читает из окружения, а окружение процесса другим
// пользователям не показывается. Модуль общий: его зовёт планировщик
// бэкапов (deploy/backup-scheduler.cjs — для psql) и скрипт бэкапа (shell,
// через CLI-режим ниже: `eval "$(node deploy/pg-url-env.cjs)"`).
//
// Из query берутся только известные libpq-параметры: Prisma-овские `?schema=…`
// libpq не принимает («invalid URI query parameter»), а прежний вызов с
// целым URL на таком адресе упал бы.

const QUERY_TO_ENV = {
  sslmode: 'PGSSLMODE',
  connect_timeout: 'PGCONNECT_TIMEOUT',
  host: 'PGHOST', // unix-сокет: postgresql:///db?host=/var/run/postgresql
};

/** @param {string} raw @returns {Record<string,string>} */
function pgEnvFromUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL не разбирается как URL');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL: ожидалась схема postgres:// или postgresql://');
  }
  const env = {};
  if (url.hostname) env.PGHOST = decodeURIComponent(url.hostname.replace(/^\[|\]$/g, ''));
  if (url.port) env.PGPORT = url.port;
  if (url.username) env.PGUSER = decodeURIComponent(url.username);
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  const db = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (db) env.PGDATABASE = db;
  for (const [param, name] of Object.entries(QUERY_TO_ENV)) {
    const value = url.searchParams.get(param);
    if (value) env[name] = value;
  }
  return env;
}

/** `export K='v'` построчно; одинарная кавычка внутри значения экранируется. */
function toShellExports(env) {
  return (
    Object.entries(env)
      .map(([k, v]) => `export ${k}='${String(v).replace(/'/g, `'\\''`)}'`)
      .join('\n') + '\n'
  );
}

module.exports = { pgEnvFromUrl, toShellExports };

if (require.main === module) {
  try {
    process.stdout.write(toShellExports(pgEnvFromUrl(process.env.DATABASE_URL || '')));
  } catch (e) {
    process.stderr.write(`[pg-url-env] ${e.message}\n`); // самого URL в сообщении нет
    process.exit(1);
  }
}
