// Досбор Арнца и ван Гендерен (гл. 6–12, приложения): собранный справочник — метка главы или приложения в тексте записи есть и в её sources; пункты доходят до листа.
import { describe, it, expect } from 'vitest';
import { buildModeGuides, buildTechniqueGuides, practiceNotes } from './index';
import { buildConcernGuides } from './concerns/all';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const LABEL = /\[Арнтц ПРЛ, ([^\]]+)\]/g;

/** «гл. 6, табл. 6.1», «прил. Ж», «гл. 7, 11, прил. Е, З» → {'гл.6', 'гл.7', 'гл.11', 'прил.Е', 'прил.З'}. */
const marksIn = (text: string): Set<string> => {
  const out = new Set<string>();
  const addRange = (a: string, b = a) => {
    for (let n = Number(a); n <= Number(b); n++) out.add(`гл.${n}`);
  };
  for (const m of text.matchAll(LABEL)) {
    let kind: 'гл' | 'прил' | 'skip' = 'skip';
    for (const part of m[1].split(', ')) {
      const ch = part.match(/^гл\.\s*(\d+)(?:–(\d+))?$/);
      const ap = part.match(/^прил\.\s*(\S+)$/);
      if (ch) {
        kind = 'гл';
        addRange(ch[1], ch[2]);
      } else if (ap) {
        kind = 'прил';
        out.add(`прил.${ap[1]}`);
      } else if (/^(табл|рис)\./.test(part)) kind = 'skip';
      else if (kind === 'гл' && /^\d+(–\d+)?$/.test(part)) {
        const [a, b] = part.split('–');
        addRange(a, b);
      } else if (kind === 'прил' && /^[А-Я]$/.test(part))
        out.add(`прил.${part}`);
    }
  }
  return out;
};

const TOUCHED = new Set([
  'cognitive_work',
  'flashcards',
  'schema_diary',
  'socratic_dialogue',
  'positive_data_log',
  'responsibility_pie',
  'behavioral_experiment',
  'pattern_breaking',
  'couple_mode_cycle',
  'imagery_rescripting',
  'problem_solving',
  'detached_protector',
  'vulnerable_child',
  'angry_child',
  'happy_child',
  'undisciplined_child',
  'crisis_call',
  'homework_not_done',
  'mode_flipping',
  'group_therapy',
  'group_techniques',
  'ending_phase',
]);

const records = [
  ...buildModeGuides(ty).map((g) => ({ id: g.modeId, ...g })),
  ...buildTechniqueGuides(ty),
  ...practiceNotes(ty),
].filter((g) => TOUCHED.has(g.id));

describe('досбор Арнца о ПРЛ, гл. 6–12: метки', () => {
  it('глава или приложение, названные в «Подробнее», есть в sources записи', () => {
    const problems: string[] = [];
    for (const g of records) {
      const used = marksIn((g.more ?? []).join(' '));
      const have = marksIn(g.sources);
      for (const m of used)
        if (!have.has(m) && (m.startsWith('прил.') || Number(m.slice(3)) >= 6))
          problems.push(`${g.id}: ${m}`);
    }
    expect(problems).toEqual([]);
  });

  it('обе записи про решение проблем и связь с режимом заведены', () => {
    expect(records.map((g) => g.id)).toContain('problem_solving');
    const undisciplined = buildModeGuides(ty).find(
      (m) => m.modeId === 'undisciplined_child',
    )!;
    expect(undisciplined.moreTechniques).toContain('problem_solving');
  });
});

describe('досбор Арнца о ПРЛ, гл. 6–12: пункты доходят до справочника', () => {
  const tech = buildTechniqueGuides(ty);
  const has = (id: string, start: string) =>
    (tech.find((t) => t.id === id)?.more ?? []).some((x) =>
      x.startsWith(start),
    );

  it('образец дневника режимов и вопросы разбора мысли встали в свои техники', () => {
    expect(has('schema_diary', 'Образец дневника режимов')).toBe(true);
    expect(has('socratic_dialogue', 'Вопросы для разбора мысли')).toBe(true);
  });

  it('цикл пары и бланки приложений встали в «Подробнее»', () => {
    expect(has('couple_mode_cycle', 'Пример цикла')).toBe(true);
    expect(
      has('pattern_breaking', 'Бланк «Изменение поведенческих паттернов»'),
    ).toBe(true);
  });

  it('пункты режимов, заметок и статьи bpd на месте', () => {
    const modes = buildModeGuides(ty);
    const detached = modes.find((m) => m.modeId === 'detached_protector')!;
    expect(
      detached.more!.some((x) =>
        x.startsWith('Защитник или Здоровый Взрослый'),
      ),
    ).toBe(true);
    const flipping = practiceNotes(ty).find((n) => n.id === 'mode_flipping')!;
    expect(
      flipping.more!.some((x) => x.startsWith('Разбор случая «пинбол»')),
    ).toBe(true);
    const bpd = buildConcernGuides(ty).find((c) => c.id === 'bpd')!;
    expect(
      bpd.course!.some((x) => x.startsWith('Три искажения мышления')),
    ).toBe(true);
  });
  it('новые пункты стоят в записи ровно один раз и после старых', () => {
    const once: [string, string][] = [
      ['imagery_rescripting', 'Почему к травме идут с уже знакомым методом'],
      ['imagery_rescripting', 'Клиенту, который не хочет ворошить прошлое'],
      ['mode_flipping', 'Разбор случая «пинбол»'],
      ['cognitive_work', 'Связь с детским эпизодом на примере'],
      ['pattern_breaking', 'Зачем отдельная фаза'],
      ['group_techniques', 'Рескрипция в группе по Арнтцу'],
    ];
    for (const [id, start] of once) {
      const more = records.find((g) => g.id === id)!.more!;
      const hits = more.filter((x) => x.startsWith(start));
      expect(hits, `${id}: ${start}`).toHaveLength(1);
    }
    const cw = records.find((g) => g.id === 'cognitive_work')!.more!;
    expect(cw.findIndex((x) => x.startsWith('Памятка ABCDE'))).toBeLessThan(
      cw.findIndex((x) => x.startsWith('Связь с детским эпизодом')),
    );
  });
});
