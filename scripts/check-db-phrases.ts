#!/usr/bin/env ts-node
// Аудит пула фраз, который живёт в БД, а не в репозитории.
//
// Гейты обходят каталоги на диске, поэтому текст, заведённый через админку, не
// видит ни один из них — так в прод уехала фраза с мужским родом и выдуманным
// «несправлянием» (2026-08). Здесь тот же самый модуль правил, что стоит на
// входе в админку (healthy-adult.quality) — одна реализация, не две.
//
//   npm run check-phrases            # отчёт
//   npm run check-phrases -- --disable  # плюс выключить найденные
//
// Скрипт НИЧЕГО не переписывает: текст фразы — авторская работа, и
// автоматическая правка испортит её тише, чем мужской род.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { findIssues } from '../src/bot/healthy-adult.quality';
import { HEALTHY_ADULT_PHRASES } from '../src/bot/healthy-adult.data';

const DISABLE = process.argv.includes('--disable');
const SEED_ONLY = process.argv.includes('--seed');

function report(rows: { id: number | string; text: string; enabled?: boolean }[]) {
  let bad = 0;
  for (const row of rows) {
    const issues = findIssues(row.text);
    if (!issues.length) continue;
    bad++;
    const state = row.enabled === false ? ' (выключена)' : '';
    const head = row.text.slice(0, 110) + (row.text.length > 110 ? '…' : '');
    console.log(`#${row.id}${state}: ${head}`);
    for (const i of issues) console.log(`    [${i.severity}/${i.kind}/${i.rule}] ${i.fragment}`);
    console.log('');
  }
  return bad;
}

async function main() {
  if (SEED_ONLY) {
    const rows = HEALTHY_ADULT_PHRASES.map((text, i) => ({ id: i + 1, text }));
    const bad = report(rows);
    console.log(bad ? `Сид: ${bad} из ${rows.length} с претензиями.` : `✓ Сид чист: ${rows.length} фраз.`);
    process.exitCode = bad ? 1 : 0;
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      'Нет DATABASE_URL. Пул живёт в базе приложения — запусти на Amvera через exec,\n' +
        'либо проверь только сид из репозитория: npm run check-phrases -- --seed',
    );
    process.exit(2);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const rows = await prisma.healthyAdultPhrase.findMany({
      select: { id: true, text: true, enabled: true },
      orderBy: { id: 'asc' },
    });
    const bad = report(rows);
    if (!bad) {
      console.log(`✓ Пул чист: ${rows.length} фраз.`);
      return;
    }
    console.log(`Пул: ${rows.length} фраз, с претензиями ${bad}.`);
    if (DISABLE) {
      const ids = rows.filter((r) => r.enabled && findIssues(r.text).length).map((r) => r.id);
      if (ids.length) {
        await prisma.healthyAdultPhrase.updateMany({
          where: { id: { in: ids } },
          data: { enabled: false },
        });
        console.log(`Выключено: ${ids.length}. Тексты сохранены — правь в админке и включай обратно.`);
      }
    } else {
      console.log('Починить: правь тексты в админке. Разом выключить найденные: -- --disable');
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: Error) => {
  console.error('Аудит пула упал:', e.message);
  process.exit(2);
});
