#!/usr/bin/env node
// Согласование формы «вы» (свип голоса 2026-07, docs/VOICE.md).
//
// Сплошная вычитка нашла класс ошибок, невидимый для check-address-form.mjs:
// тот ищет остаточные «ты»-местоимения, а здесь «вы» на месте, но второе
// слово в паре осталось в единственном числе мужского рода — «вы благодарен»,
// «вы дал кому-то почувствовать», «как вы привык», «вы компетентен».
// Пользователь с формой «вы» видит это в каждой такой подсказке.
//
// Проверка жёсткая, без бейслайна: сейчас таких мест ноль, и новых быть
// не должно. Ложное срабатывание чинится точечным исключением здесь же.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(import.meta.dirname, '..');
const SCAN = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];

// \b в JS не работает по кириллице — границы через lookaround.
const B = '(?<![А-Яа-яЁё])';
const A = '(?![А-Яа-яЁё])';

// Экспорт ради address-agreement.spec.ts (пинит каждый паттерн образцом, как
// PATTERNS в check-gendered-forms.mjs). name уникален, kind — старый ярлык
// для сообщения об ошибке (у двух паттернов совпадает намеренно).
export const PATTERNS = [
  // «вы сказал», «вы бы понял»
  ['past-regular', new RegExp(`${B}[Вв]ы\\s+(?:бы\\s+)?[а-яё]+[аяиеёу]л${A}`, 'g'), 'прошедшее ед.ч.'],
  // мог, привык, вырос, нёс… — прошедшее без -л
  ['past-irregular', new RegExp(`${B}[Вв]ы\\s+(?:бы\\s+)?(?:[а-яё]*мог|привык|отвык|вырос|подрос|нёс|вёз|лез|берёг|тёк)${A}`, 'g'), 'прошедшее ед.ч.'],
  // краткие прилагательные/причастия муж.рода
  ['short-adj', new RegExp(`${B}[Вв]ы\\s+(?:благодарен|компетентен|уверен|готов|рад|должен|способен|виноват|свободен|спокоен|силён|доволен|занят|устал|важен|нужен|похож)${A}`, 'g'), 'краткое прилагательное'],
];

function walk(p, acc = []) {
  let st;
  try { st = statSync(join(ROOT, p)); } catch { return acc; }
  if (st.isFile()) {
    // Тесты пропускаем: «вы благодарен» внутри спека — это фикстура, на
    // которой проверяют сам гейт, а не текст, который увидит пользователь.
    // Без этого исключения тест на гейт роняет гейт (что и случилось).
    if (/\.(spec|test)\.(ts|tsx)$/.test(p)) return acc;
    if (/\.(ts|tsx)$/.test(p)) acc.push(p);
    return acc;
  }
  for (const n of readdirSync(join(ROOT, p))) {
    if (n === 'node_modules' || n === 'dist') continue;
    walk(p + '/' + n, acc);
  }
  return acc;
}

// CLI-логика — только при запуске как скрипт (не при импорте PATTERNS).
function main() {
  const hits = [];
  for (const file of SCAN.flatMap((d) => walk(d))) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // комментарии — не user-facing
      for (const [, re, kind] of PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) {
          hits.push({ file, ln: i + 1, kind, hit: m[0].replace(/\s+/g, ' ') });
        }
      }
    });
  }

  if (hits.length) {
    console.error(
      `❌ Согласование «вы»: ${hits.length} мест, где после «вы» стоит форма единственного числа.\n`,
    );
    for (const h of hits) {
      console.error(`  ${h.file}:${h.ln} [${h.kind}] «${h.hit}»`);
    }
    console.error(
      '\nПользователь с формой «вы» читает это как ошибку. Поправь второе слово\n' +
        'во множественное число: «вы дал» → «вы дали», «вы благодарен» → «вы благодарны».\n' +
        'Если согласование относится к третьему лицу («никто не просил») — перестрой фразу.',
    );
    process.exit(1);
  }
  console.log('✓ согласование «вы»: рассогласований нет');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
