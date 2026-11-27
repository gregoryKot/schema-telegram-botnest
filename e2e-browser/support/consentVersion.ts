import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Редакция согласия из shared/src/onboarding/consents.ts. Импортировать модуль нельзя:
// shared — ESM-пакет ("type": "module"), а jest e2e бэкенда работает в CommonJS и падает
// на «Must use import to load ES Module». Поэтому читаем константу из исходника —
// единый источник правды сохраняется, дублирующего литерала нет.
const SRC = join(
  __dirname,
  '..',
  '..',
  'shared',
  'src',
  'onboarding',
  'consents.ts',
);
const match = /export const CONSENT_VERSION = '([^']+)'/.exec(
  readFileSync(SRC, 'utf8'),
);
if (!match) throw new Error(`CONSENT_VERSION не найден в ${SRC}`);

export const CONSENT_VERSION: string = match[1];
