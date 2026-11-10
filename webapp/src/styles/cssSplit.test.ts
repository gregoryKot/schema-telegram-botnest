// @vitest-environment node
// Раскрой общих CSS по экранам (2026-11): разделы sheet-tasks.css, sheet-diary.css, конца
// index.css и чужие разделы в файлах экранов уехали в свои файлы, а каскад остался прежним
// только потому, что эти файлы подключаются через @import в прежнем порядке. Сверка держит
// три вещи: порядок @import (он и есть порядок правил в сборке), то, что часть подключена
// ровно одним файлом и ни одним компонентом (иначе её правила попадут в сборку дважды и в
// другое место каскада), и то, что @import стоит в начале файла (иначе браузер его молча
// пропускает).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLES = __dirname;
const SRC = join(STYLES, '..');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const importsOf = (css: string) => [...strip(css).matchAll(/@import\s+'([^']+)';/g)].map((m) => m[1].replace(/^\.\/(styles\/)?/, ''));

const cssFiles = readdirSync(STYLES).filter((f) => f.endsWith('.css'));
const text = (f: string) => readFileSync(join(STYLES, f), 'utf8');

/** Файл → его @import по порядку. Порядок — порядок правил в сборке: не переставлять. */
const SPLIT: Record<string, string[]> = {
  'index-tail.css': ['therapist-sheet.css', 'settings-nav.css', 'dialog-center.css', 'ex-legacy.css', 'modemap-handles.css'],
  'sheet-tasks.css': ['plans.css', 'feeds.css', 'flashcard.css', 'dialogs.css', 'celebration.css', 'error-screen.css', 'all-tasks.css', 'nudges.css', 'therapist-disclaimer.css'],
  'sheet-diary.css': ['history.css', 'diary-explainer.css', 'card-tone.css', 'diary-wizard.css', 'diary-mode.css', 'diary-gratitude.css', 'note-sheet.css', 'share-sheet.css', 'journey.css'],
  'sheet-exercises.css': ['ex-cards.css', 'ex-belief.css', 'ex-letter.css', 'ex-phrase.css', 'ex-wheel.css', 'ex-case.css', 'ex-warm.css'],
  'sheet-schemas.css': ['ss-sheet.css', 'schema-library.css'],
  'sheet-tracker.css': ['need-detail.css', 'checkin.css'],
  'tracker-question.css': ['flow-frame.css'],
  'client-practice.css': ['task-row.css'],
  'practice-selfhelp.css': ['crisis.css'],
  'therapy-bridge.css': ['therapy-caution.css'],
  'therapist-concept.css': ['concept-graph.css'],
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('раскрой CSS: порядок @import = прежний каскад', () => {
  it.each(Object.entries(SPLIT))('%s подключает свои части в прежнем порядке', (file, parts) => {
    expect(importsOf(text(file))).toEqual(parts);
  });

  it('у сборников нет своих правил: только @import', () => {
    for (const f of ['index-tail.css', 'sheet-tasks.css', 'sheet-diary.css']) {
      expect(strip(text(f)).replace(/@import\s+'[^']+';/g, '').trim(), f).toBe('');
    }
  });

  it('main.tsx: index.css → styles/index-tail.css → utilities.css', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    const at = ["import './index.css'", "import './styles/index-tail.css'", "import '../../shared/src/theme/utilities.css'"].map((s) => main.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('@import стоит в начале файла, до первого правила', () => {
    for (const f of [...cssFiles.map((n) => join(STYLES, n)), join(SRC, 'index.css')]) {
      const css = strip(readFileSync(f, 'utf8'));
      const last = css.lastIndexOf('@import');
      if (last >= 0) expect(css.slice(0, last), f).not.toContain('{');
    }
  });

  it('каждую часть подключает ровно один css, и ни один компонент — напрямую', () => {
    const importers = new Map<string, string[]>();
    for (const f of [...cssFiles, '../index.css']) {
      for (const p of importsOf(readFileSync(join(STYLES, f), 'utf8'))) importers.set(p, [...(importers.get(p) ?? []), f]);
    }
    const parts = Object.values(SPLIT).flat();
    for (const p of parts) expect(importers.get(p), p).toEqual([Object.keys(SPLIT).find((k) => SPLIT[k].includes(p))]);
    const direct = walk(SRC).flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return parts.filter((p) => src.includes(`styles/${p}'`)).map((p) => `${f.slice(SRC.length + 1)} → ${p}`);
    });
    expect(direct).toEqual([]);
  });
});
