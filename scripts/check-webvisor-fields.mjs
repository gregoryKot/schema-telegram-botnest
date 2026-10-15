#!/usr/bin/env node
// Вебвизор Метрики на визитке (kotlarewski.gr) пишет нажатия клавиш во всех
// полях, кроме помеченных `ym-disable-keys`. Политика конфиденциальности
// обещает: «содержимое полей ввода не записывается». Поле без метки —
// нарушенное обещание, а не недочёт стиля. Класс повторился трижды: E-2
// (формы записи, аудит 2026-08), поля email на /donate и /subscribe
// (security#27, аудит 2026-10) — каждый раз чинили поле, а не класс.
//
// Что проверяет: берёт страницы визитки из `personalRoutes` в
// webapp/src/App.tsx (и компоненты вокруг них из `Root`), обходит их
// относительные импорты и требует у каждого текстового <input>/<textarea>
// метку `ym-disable-keys`. Не требует её у checkbox/radio/range/hidden/
// file/кнопок и у aria-hidden-ловушек (honeypot).
//
// Граница обхода — файл с `ym-hide-content`: он объявляет свой корень скрытым
// от записи целиком (AdminPage), и всё под ним (импорты) покрыто предком.
// Это приближение: если скрытый корень оборачивает не весь файл, а импорт
// стоит снаружи обёртки, гейт промолчит — такой случай ловит ревью.
//
// Абсолютный, без бейслайна: на момент введения долг ноль (правило №15).
// Пары к гейту секретов (ссылка встречи, токен в href) — тест
// webapp/src/components/booking/webvisorSecrets.test.tsx.
import { fileURLToPath } from 'url';
import { resolve, join } from 'path';
import { loadStripped, relativeImports, routeRoots, unmarkedFields, MARKER_HIDE, MARKER_KEYS } from './webvisor-fields-scan.mjs';

const ROOT = join(import.meta.dirname, '..');
const APP = 'webapp/src/App.tsx';

export function collect(root = ROOT) {
  const { files: roots, names } = routeRoots(root, APP);
  const seen = new Set();
  const queue = [...roots];
  const bad = [];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const text = loadStripped(root, rel);
    if (text.includes(MARKER_HIDE)) continue; // скрытый корень: покрыт и сам файл, и всё под ним
    for (const f of unmarkedFields(text)) bad.push({ file: rel, ...f });
    queue.push(...relativeImports(root, rel, text));
  }
  return { bad, scanned: seen.size, roots: names };
}

function main() {
  const { bad, scanned, roots } = collect();
  if (!roots.length) {
    console.error(`❌ check-webvisor-fields: в ${APP} не найден personalRoutes — гейт ослеп. Поправь разбор, а не гейт.`);
    process.exit(1);
  }
  if (bad.length) {
    console.error(`❌ Вебвизор: ${bad.length} текстовых полей на страницах визитки без метки ${MARKER_KEYS}.\n`);
    for (const b of bad) console.error(`  ${b.file}:${b.line}  ${b.tag}`);
    console.error(
      `\nНа визитке Вебвизор пишет нажатия клавиш, а политика обещает обратное. Добавь\n` +
        `className="${MARKER_KEYS}" полю (образец — BookingPicker.tsx) либо оберни экран\n` +
        `в ${MARKER_HIDE} (образец — AdminPage.tsx). Исключений и бейслайна нет: правило №15.`,
    );
    process.exit(1);
  }
  console.log(`✓ Вебвизор: все текстовые поля визитки помечены (файлов просмотрено: ${scanned})`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
