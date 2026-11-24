// @vitest-environment node
// Храповик: сдвинутая сплошная тень (`Xpx Ypx 0 цвет`) — только у опор экрана и плавающих слоёв.
// Остальные карточки — тонкая линия --panel-line без тени. Новая тень = строка в ANCHORS с причиной.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
// Лендинг-визитка (product-*) вне охвата; чинится отдельной карточкой, см. docs/BACKLOG.md.
const EXEMPT = /(^|\/)product-(landing|tests)[\w-]*\.css$/;

const ANCHORS = [
  'index.css|.cookie-banner', 'index.css|.sheet-modal-box', // плавающие слои
  'styles/dialogs.css|.sk-dialog-box', 'styles/command-palette.css|.cmd-panel',
  'styles/client-profile.css|.cpf-paper-dlg', 'styles/client-profile.css|.cpf-paper-dlg--list',
  'styles/auth-service.css|.as-card', 'styles/auth-service.css|.as-card--skel', // главная карточка входа
  'styles/journey.css|.jr-hero', 'styles/paper-app.css|.pa-outcome-card', // главные карточки экрана
  'styles/paper.css|.pp-leaf--anchor', 'styles/paper.css|.pp-leaf--anchor[style*="--h"]', // опорный лист
].sort();

const OFFSET = /(^|,)\s*-?\d+px\s+-?\d+px\s+0(px)?\s+(oklch|var|color-mix|#|rgb)/;

function cssFiles(rel = ''): string[] {
  return readdirSync(join(SRC, rel), { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) return cssFiles(r);
    return e.name.endsWith('.css') && !EXEMPT.test(r) ? [r] : [];
  });
}

function offsetShadowSelectors(): string[] {
  const out = new Set<string>();
  for (const f of cssFiles()) {
    const css = readFileSync(join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const v = /box-shadow:\s*([^;]+)/.exec(m[2])?.[1];
      if (!v || /inset/.test(v) || !OFFSET.test(v)) continue;
      for (const s of m[1].split(',')) out.add(`${f}|${s.trim().replace(/\s+/g, ' ')}`);
    }
  }
  return [...out].sort();
}

describe('сдвинутая сплошная тень — только у опор', () => {
  it('список селекторов равен списку опор и не растёт', () => {
    expect(offsetShadowSelectors()).toEqual(ANCHORS);
  });
  it('.pp-leaf по умолчанию — линия, тень у модификатора', () => {
    const css = readFileSync(join(SRC, 'styles/paper.css'), 'utf8');
    expect(/\.pp-leaf \{[^}]*box-shadow: 0 0 0 1px var\(--panel-line\)/.test(css)).toBe(true);
  });
});
