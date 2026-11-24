// Глубина — сплошной сдвинутый слой бумаги (.sk-dialog-box), а не мягкая тень «на воздухе»:
// внешний box-shadow с размытием > 0 разрешён только у перечисленных селекторов, у каждого причина.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRules } from './cssRules.test-helpers';

const SOFT_TOKENS = /var\(--(shadow-[12]|glass-shadow)\b/;

/** Слои внешней тени, у которых размытие > 0 (var(--shadow-N) считается размытой тенью). */
function softShadowLayers(value: string): string[] {
  const layers = value.split(/,(?![^(]*\))/).map((l) => l.trim()).filter(Boolean);
  return layers.filter((l) => {
    if (/\binset\b/.test(l) || /^(none|inherit|initial|unset)$/.test(l)) return false;
    if (SOFT_TOKENS.test(l)) return true;
    const nums = l.replace(/\([^)]*\)/g, '').match(/-?\d*\.?\d+(?:px)?(?=\s|$)/g) ?? [];
    return nums.length >= 3 && parseFloat(nums[2]) > 0;
  });
}

/** Исключения: селектор → почему мягкая тень законна или чем занят отдельный PR. */
const ALLOWED: Record<string, string> = {
  '.ds-menu': 'всплывающее меню «⋯»: --shadow-2 отделяет его от страницы',
  '.mobile-nav': 'стеклянная нижняя панель: --glass-shade и тень стекла',
  '.mobile-nav-item.active': 'активный пункт стеклянной панели: --glass-shadow',
  '.ct-link.ct-head-why': 'стеклянная пилюля шапки «Сегодня»: --glass-shadow',
  '.ds-seg-btn.is-active': 'выбранный сегмент: тонкая тень — ждёт отдельного PR (кнопки)',
  '.cz-block.is-lifted': 'подъём блока при перетаскивании — обратная связь',
};
/** Файлы целиком. */
const ALLOWED_FILES: Record<string, string> = {
  'therapist-guide.css': 'Справочник: ждёт отдельного PR',
  'modemap-handles.css': 'ручки холста карты режимов — обратная связь',
};

const dir = __dirname;
const files = [join(dir, '../index.css'), ...readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => join(dir, f))];

function findSoftShadows(css: string, file: string): string[] {
  const base = file.split('/').pop() ?? file;
  if (ALLOWED_FILES[base]) return [];
  const out: string[] = [];
  for (const r of parseRules(css)) {
    for (const m of r.body.matchAll(/(?:^|;)\s*box-shadow\s*:([^;]+)/g)) {
      if (!softShadowLayers(m[1]).length) continue;
      for (const s of r.selectors) {
        const sel = s.replace(/^html\[data-theme="[a-z]+"\]\s+/, '');
        if (!Object.keys(ALLOWED).some((a) => sel === a || sel.startsWith(a + ' ') || sel.startsWith(a + ':'))) out.push(`${base}: ${s}`);
      }
    }
  }
  return out;
}

describe('paperDepth: нет мягких теней на воздухе', () => {
  it('в стилях сайта внешняя тень с размытием только у исключений', () => {
    const bad = files.flatMap((f) => findSoftShadows(readFileSync(f, 'utf8'), f));
    expect(bad).toEqual([]);
  });

  it('ловит образец с нарушением и пропускает бумажный слой и исключения', () => {
    expect(findSoftShadows('.x { box-shadow: 0 8px 28px rgba(0,0,0,.2); }', 'a.css')).toEqual(['a.css: .x']);
    expect(findSoftShadows('.x { box-shadow: var(--shadow-1); }', 'a.css')).toEqual(['a.css: .x']);
    expect(findSoftShadows('.x { box-shadow: 10px 11px 0 var(--paper-sunk); }', 'a.css')).toEqual([]);
    expect(findSoftShadows('.x { box-shadow: inset 0 0 8px red; }', 'a.css')).toEqual([]);
    expect(findSoftShadows('.ds-menu { box-shadow: var(--shadow-2); }', 'a.css')).toEqual([]);
  });
});
