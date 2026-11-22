#!/usr/bin/env node
// Гейт раздела «Ждёт владельца» в docs/BACKLOG.md: вопросы владельцу лежат в
// одном месте, и по каждой строке можно ответить, не разыскивая чат.
// Раздел читает ежедневная сводка (scheduled task): строка без вопроса,
// рекомендации, ссылки или даты превращается в напоминание ни о чём.
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const FILE = 'docs/BACKLOG.md';
const TITLE = 'Ждёт владельца';
const EMPTY = 'Пусто.';

const lines = readFileSync(join(ROOT, FILE), 'utf8').split('\n');
const headings = lines.flatMap((l, i) => (l.startsWith('## ') ? [{ i, title: l.slice(3).trim() }] : []));
const problems = [];

if (headings[0]?.title !== TITLE) {
  problems.push(`${FILE}: первым разделом должен стоять «## ${TITLE}» (пустой — со строкой «${EMPTY}»)`);
} else {
  const body = lines.slice(headings[0].i + 1, headings[1]?.i ?? lines.length);
  let items = 0;
  body.forEach((text, k) => {
    if (!text.startsWith('- ')) return;
    items += 1;
    const missing = [];
    if (!/\*\*[^*]+\?\*\*/.test(text)) missing.push('вопрос жирным со знаком «?»');
    if (!text.includes('Рекомендация:')) missing.push('«Рекомендация:»');
    if (!/\]\(https:\/\/[^)\s]+\)/.test(text)) missing.push('ссылка на чат или артефакт');
    if (!/\b20\d\d-\d\d-\d\d\b/.test(text)) missing.push('дата YYYY-MM-DD');
    if (missing.length > 0) {
      problems.push(`${FILE}:${headings[0].i + 2 + k}: в строке нет: ${missing.join(', ')}`);
    }
  });
  const hasEmpty = body.some((l) => l.trim() === EMPTY);
  if (items === 0 && !hasEmpty) problems.push(`${FILE}: раздел «${TITLE}» пуст — поставь строку «${EMPTY}»`);
  if (items > 0 && hasEmpty) problems.push(`${FILE}: в разделе «${TITLE}» есть вопросы — убери строку «${EMPTY}»`);
}

if (problems.length > 0) {
  console.error('❌ Раздел «Ждёт владельца» не в порядке (формат — .claude/rules/process.md):\n');
  for (const p of problems) console.error(`   ${p}`);
  process.exit(1);
}
console.log('✓ Раздел «Ждёт владельца» на месте, строки с вопросом, рекомендацией, ссылкой и датой.');
