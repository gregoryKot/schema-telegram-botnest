// «Название в тексте — значит, и связь в поле» (.claude/rules/knowledge-base.md, раздел 2): режим,
// названный в тексте раздела схемы, стоит в её modeIds или записан в TEXT_MENTIONS_WITHOUT_LINK.
import { describe, expect, it } from 'vitest';
import { ALL_MODES } from '../schemaTherapyData';
import { buildSchemaGuides } from '../guide/index';
import type { Tr } from '../guide/types';
import { gapProblems } from './check';
import { MODES_WITHOUT_SCHEMA, TEXT_MENTIONS_WITHOUT_LINK } from './gaps';
import { mentionedModes, schemaGuideText } from './mentions';

const tr: Tr = (t) => t;

describe('названия режимов в текстах разделов схем', () => {
  // Здоровые режимы — цель работы: их называют в каждом разделе, связью схемы они не становятся.
  const modes = ALL_MODES.filter(
    (m) => MODES_WITHOUT_SCHEMA[m.id]?.kind !== 'theory',
  );
  const found = buildSchemaGuides(tr).flatMap((g) =>
    mentionedModes(schemaGuideText(g), modes)
      .filter((id) => !g.modeIds.includes(id))
      .map((id) => `${g.schemaId}→${id}`),
  );

  it('назван в тексте — стоит в modeIds схемы (или строка в kb/gaps.ts)', () => {
    const listed = Object.keys(TEXT_MENTIONS_WITHOUT_LINK);
    const r = gapProblems(found, listed, listed);
    expect(
      r.unlisted,
      'добавь режим в modeIds схемы, перепиши текст без названия или внеси пару в TEXT_MENTIONS_WITHOUT_LINK',
    ).toEqual([]);
    expect(
      r.stale,
      'названия в тексте больше нет или связь уже есть — удали строку из kb/gaps.ts',
    ).toEqual([]);
  });

  it('у каждой строки есть причина', () => {
    const short = Object.entries(TEXT_MENTIONS_WITHOUT_LINK).filter(
      ([, g]) => g.why.length < 20,
    );
    expect(short).toEqual([]);
  });
});
