#!/usr/bin/env node
// Контрол без имени из одного глифа (аудит 2026-10-11, «Доступность»).
//
// `<button>←</button>`, `<div {...pressable(f)}>×</div>`, кнопка с одной
// иконкой: скринридер читает «стрелка влево», «знак умножения» или просто
// «кнопка» — что она делает, не узнать. jsx-a11y/control-has-associated-label
// (включено в webapp/eslint.config.js и для shared/ в корневом конфиге) этот
// класс НЕ видит: для правила «←» и есть текстовая подпись, а иконку-компонент
// оно считает возможной подписью. Поэтому половина класса живёт здесь.
//
// Что ловится: <button>, <a>, элемент с role button/link/switch/checkbox/
// radio/tab/menuitem или со спредом {...pressable(...)} — без aria-label и
// aria-labelledby, чьё содержимое не несёт ни одной буквы или цифры: глиф,
// svg, *Icon-компонент, элемент с aria-hidden или пусто.
//
// Чего гейт сознательно не делает (правило №15: ложно-красный гейт отключают):
//   — не требует aria-label у КАЖДОГО pressable(): у ~100 таких div есть
//     текст, имя берётся из содержимого;
//   — не гадает о содержимом выражений и чужих компонентов ({label},
//     <Badge/>, {...props}): там может быть имя, и это видит eslint-правило;
//   — title именем не считает: на тач-устройствах его не озвучивают и не
//     показывают, это подсказка мыши, а не имя.
//
// Область — webapp/src и shared/src. schema-miniapp не покрыт: мини-апп
// удаляется по docs/ONE_FRONTEND_PLAN.md, его девять глиф-кнопок записаны в
// docs/open/one-frontend.md «Что осталось открытым». Абсолютный, без бейслайна.
import { readFileSync, readdirSync, statSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const SCAN_DIRS = ['webapp/src', 'shared/src'];
const CONTROL_ROLE = /^(button|link|switch|checkbox|radio|tab|menuitem)$/;
const ROLE_IN_EXPR = /['"`](button|link|switch|checkbox|radio|tab|menuitem)['"`]/;
const NAME_ATTR = /^aria-label(ledby)?$/;

// В CI гейт стоит в джобе webapp: там установлен только webapp/node_modules.
function loadTypescript() {
  for (const pkg of ['webapp/package.json', 'package.json']) {
    try {
      return createRequire(join(ROOT, pkg))('typescript');
    } catch {
      // следующий кандидат
    }
  }
  console.error('❌ check-glyph-controls: не найден typescript (npm ci --prefix webapp)');
  process.exit(2);
}
const ts = loadTypescript();

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return acc;
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist' && name !== 'test-support') walk(rel, acc);
    } else if (name.endsWith('.tsx') && !/\.(test|spec)\.tsx$|test-helpers/.test(name)) {
      acc.push(rel);
    }
  }
  return acc;
}

const attrsOf = (el) => (ts.isJsxElement(el) ? el.openingElement : el).attributes.properties;
const tagOf = (el, sf) => (ts.isJsxElement(el) ? el.openingElement : el).tagName.getText(sf);
const attrName = (a, sf) => (ts.isJsxAttribute(a) ? a.name.getText(sf) : null);
const hasAttr = (el, sf, re) => attrsOf(el).some((a) => re.test(attrName(a, sf) ?? ''));

/** Что элемент даёт имени: текст, ничего (иконка/aria-hidden) или «неизвестно». */
function contentOf(children, sf, acc = { text: '', unknown: false }) {
  for (const c of children) {
    if (ts.isJsxText(c)) {
      acc.text += c.getText(sf).replace(/&#?\w+;/g, '·');
    } else if (ts.isJsxExpression(c)) {
      if (!c.expression) continue;
      if (ts.isStringLiteral(c.expression) || ts.isNoSubstitutionTemplateLiteral(c.expression)) {
        acc.text += c.expression.text;
      } else acc.unknown = true;
    } else if (ts.isJsxFragment(c)) {
      contentOf(c.children, sf, acc);
    } else if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) {
      const tag = tagOf(c, sf);
      if (hasAttr(c, sf, /^aria-hidden$/) || tag === 'svg' || /Icon/.test(tag)) continue;
      if (/^[A-Z]/.test(tag) || tag.includes('.') || hasAttr(c, sf, /^(alt|aria-label(ledby)?)$/)) {
        acc.unknown = true;
      } else if (ts.isJsxElement(c)) {
        contentOf(c.children, sf, acc);
      }
    }
  }
  return acc;
}

function isControl(el, sf) {
  const tag = tagOf(el, sf);
  if (tag === 'button' || tag === 'a') return true;
  return attrsOf(el).some((a) => {
    if (ts.isJsxSpreadAttribute(a)) return /^pressable\(/.test(a.expression.getText(sf));
    if (attrName(a, sf) !== 'role' || !a.initializer) return false;
    if (ts.isStringLiteral(a.initializer)) return CONTROL_ROLE.test(a.initializer.text);
    return ROLE_IN_EXPR.test(a.initializer.getText(sf));
  });
}

function scan(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  const visit = (n) => {
    if ((ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && isControl(n, sf)) {
      const attrs = attrsOf(n);
      const named = attrs.some((a) => NAME_ATTR.test(attrName(a, sf) ?? ''));
      // Чужой спред ({...props}) может нести aria-label — не гадаем.
      const foreignSpread = attrs.some(
        (a) => ts.isJsxSpreadAttribute(a) && !/^pressable\(/.test(a.expression.getText(sf)),
      );
      if (!named && !foreignSpread) {
        const { text, unknown } = ts.isJsxElement(n) ? contentOf(n.children, sf) : { text: '', unknown: false };
        if (!unknown && !/[\p{L}\p{N}]/u.test(text)) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          hits.push(`${rel}:${line + 1} <${tagOf(n, sf)}> «${text.trim() || 'иконка/пусто'}»`);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return hits;
}

const hits = SCAN_DIRS.flatMap((d) => walk(d)).flatMap(scan);
if (hits.length) {
  console.error(`❌ Контрол без имени: ${hits.length}\n`);
  for (const h of hits) console.error('  ' + h);
  console.error(
    '\nДобавь aria-label по смыслу действия, без обращения: «Назад», «Закрыть»,' +
      '\n«Добавить», «Удалить». Глиф для скринридера — не имя.',
  );
  process.exit(1);
}
console.log('✓ контролы без имени (глиф, иконка, пусто): ни одного');
