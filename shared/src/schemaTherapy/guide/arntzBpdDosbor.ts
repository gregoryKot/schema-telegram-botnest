import type { ModeGuide, PracticeNote, TechniqueGuide, Tr } from './types';
import { withSessionSigns } from './modes/sessionSigns';
import { MODE_ADD, NOTE_ADD } from './arntzBpdDosborModes';
import { TECH_ADD } from './arntzBpdDosborTech';

/** Досбор книги Арнца и ван Гендерен о ПРЛ (гл. 1–5): что дописать к записи, не раздувая её файл (file-size-baseline). */
export interface BpdAdd {
  /** Главы книги, на которые опираются добавки: дописываются в `sources` записи. */
  chapters: number[];
  /** Абзацы в конец «Подробнее»; до пункта табл. 3.3 у режимов. */
  more?: string[];
  /** Реплики (две формы обращения через tr) в конец «Как это звучит». */
  voice?: (tr: Tr) => string[];
  /** Ловушки и «когда не делать» — к `cautions` техники. */
  cautions?: string;
}

const NUM = /^\d+(–\d+)?$/;

/** Добавляет номера глав в метку `[Арнтц ПРЛ, гл. …]` или заводит метку, если её не было. */
export function withChapters(sources: string, chapters: number[]): string {
  const m = sources.match(/\[Арнтц ПРЛ, гл\. ([^\]]+)\]/);
  if (!m) return `${sources}, [Арнтц ПРЛ, гл. ${chapters.join(', ')}]`;
  const tokens = m[1].split(', ');
  const covered = new Set<number>();
  for (const t of tokens.filter((x) => NUM.test(x))) {
    const [a, b = a] = t.split('–').map(Number);
    for (let n = a; n <= b; n++) covered.add(n);
  }
  const missing = chapters.filter((n) => !covered.has(n));
  if (!missing.length) return sources;
  const last = tokens.map((t) => NUM.test(t)).lastIndexOf(true);
  tokens.splice(last + 1, 0, ...missing.map(String));
  return sources.replace(m[0], `[Арнтц ПРЛ, гл. ${tokens.join(', ')}]`);
}

function apply<T extends ModeGuide | TechniqueGuide | PracticeNote>(
  g: T,
  add: BpdAdd | undefined,
  tr: Tr,
): T {
  if (!add) return g;
  const out = { ...g, sources: withChapters(g.sources, add.chapters) };
  if (add.more) out.more = [...(g.more ?? []), ...add.more];
  if (add.voice) out.voice = [...(g.voice ?? []), ...add.voice(tr)];
  if (add.cautions) {
    (out as TechniqueGuide).cautions = [
      (g as TechniqueGuide).cautions,
      add.cautions,
    ]
      .filter(Boolean)
      .join(' ');
  }
  return out;
}

/** Режим с добавками досбора, затем пункт табл. 3.3 (он обязан стоять последним). */
export const arntzMode =
  (tr: Tr) =>
  (g: ModeGuide): ModeGuide =>
    withSessionSigns(apply(g, MODE_ADD[g.modeId], tr));

export const arntzTech =
  (tr: Tr) =>
  (g: TechniqueGuide): TechniqueGuide =>
    apply(g, TECH_ADD[g.id], tr);

export const arntzNote =
  (tr: Tr) =>
  (g: PracticeNote): PracticeNote =>
    apply(g, NOTE_ADD[g.id], tr);
