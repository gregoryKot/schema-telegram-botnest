import { describe, it, expect } from 'vitest';
import { FEEL_GATES } from '../../mode/modeFeelGates';
import { MODE_DESC } from '../../mode/modePickerDesc';
import { CASE_BODY_CHIPS } from '../caseBodyChips';
import { CASE_IMPULSES, IMPULSE_SECOND_DOOR } from '../caseImpulses';
import {
  INITIAL_QUICK_FIELDS,
  STEADY_MODE_ID,
  buildQuickCardBody,
  buildQuickResult,
  buildQuickSaveData,
  buildSteadySaveData,
  chipsText,
  pickCandidateMode,
  quickModeName,
  shortScene,
  type CaseQuickFields,
} from './caseQuick';

const fields = (over: Partial<CaseQuickFields> = {}): CaseQuickFields => ({
  ...INITIAL_QUICK_FIELDS,
  scene: 'Она ответила одним словом',
  gateId: 'fear',
  ...over,
});

describe('pickCandidateMode', () => {
  it('порыв с соответствием сильнее ворот', () => {
    expect(pickCandidateMode('fear', ['impulse_close'])).toBe(
      IMPULSE_SECOND_DOOR.impulse_close,
    );
  });

  it('берёт первый порыв, у которого есть соответствие', () => {
    expect(
      pickCandidateMode('sad', [
        'impulse_agree',
        'impulse_sharp',
        'impulse_close',
      ]),
    ).toBe(IMPULSE_SECOND_DOOR.impulse_sharp);
  });

  it('«Своё…» и «Согласиться…» без соответствия — первый режим ворот', () => {
    const first = (id: string) =>
      FEEL_GATES.find((g) => g.id === id)!.leaves[0].modeId;
    expect(pickCandidateMode('anger', ['impulse_own'])).toBe(first('anger'));
    expect(pickCandidateMode('shame', ['impulse_agree'])).toBe(first('shame'));
    expect(pickCandidateMode('drained', [])).toBe(first('drained'));
  });

  it('ворот нет — ворота «пусто или не пойму»', () => {
    const unknown = FEEL_GATES.find((g) => g.id === 'unknown')!.leaves[0]
      .modeId;
    expect(pickCandidateMode(null, [])).toBe(unknown);
  });

  it('каждый кандидат известен: имя и описание есть для всех ворот и порывов', () => {
    const ids = [
      ...FEEL_GATES.map((g) => pickCandidateMode(g.id as never, [])),
      ...Object.keys(IMPULSE_SECOND_DOOR).map((i) =>
        pickCandidateMode('fear', [i]),
      ),
    ];
    for (const id of ids) {
      expect(MODE_DESC[id], id).toBeTruthy();
      expect(quickModeName(id), id).not.toBe(id);
    }
  });
});

describe('quickModeName', () => {
  it('имя режима с заглавных обоих слов', () => {
    expect(quickModeName('vulnerable_child')).toBe('Уязвимый Ребёнок');
    expect(quickModeName('punitive_critic')).toBe('Карающий Критик');
  });
  it('режим вне реестра — сам id, не пустота', () => {
    expect(quickModeName('нет_такого')).toBe('нет_такого');
  });
});

describe('chipsText', () => {
  const chips = CASE_BODY_CHIPS.fear;
  const own = chips.find((c) => c.id.endsWith('_own'))!;
  it('метки с маленькой буквы через запятую', () => {
    const [a, b] = chips.filter((c) => !c.id.endsWith('_own'));
    expect(chipsText(chips, [a.id, b.id], '')).toBe(
      `${a.label[0].toLowerCase()}${a.label.slice(1)}, ${b.label[0].toLowerCase()}${b.label.slice(1)}`,
    );
  });
  it('«Своё…» заменяется текстом человека, пустое — пропускается', () => {
    const first = chips[0];
    expect(chipsText(chips, [first.id, own.id], 'сжало горло')).toContain(
      'сжало горло',
    );
    expect(chipsText(chips, [own.id], '  ')).toBe('');
  });
});

describe('shortScene', () => {
  it('короткая сцена не меняется', () => {
    expect(shortScene(' привет ')).toBe('привет');
  });
  it('длинная режется по границе слова', () => {
    const out = shortScene('слово '.repeat(30), 20);
    expect(out.endsWith('…')).toBe(true);
    expect(
      out
        .replace('…', '')
        .trim()
        .split(' ')
        .every((w) => w === 'слово'),
    ).toBe(true);
  });
});

describe('сборка итога и записи', () => {
  const bodyChips = CASE_BODY_CHIPS.fear;
  const f = fields({
    bodyChipIds: [bodyChips[0].id],
    impulseChipIds: ['impulse_close', 'impulse_own'],
    impulseOwn: 'исчезнуть',
  });

  it('итог: имя, описание, строки «Момент / Внутри / Хотелось»', () => {
    const r = buildQuickResult(f, bodyChips, CASE_IMPULSES);
    expect(r.modeId).toBe('avoidant_protector');
    expect(r.name).toBe('Избегающий Защитник');
    expect(r.desc).toBe(MODE_DESC.avoidant_protector);
    expect(r.rows.map((x) => x.label)).toEqual([
      'Момент',
      'Внутри',
      'Хотелось',
    ]);
    expect(r.rows[1].text).toContain('Страшно, тревожно');
    expect(r.rows[2].text).toContain('исчезнуть');
    expect(r.need).not.toMatch(/\.$/);
  });

  it('пустые строки итога не показываются', () => {
    const r = buildQuickResult(fields({ scene: '' }), bodyChips, CASE_IMPULSES);
    expect(r.rows.map((x) => x.label)).toEqual(['Внутри']);
  });

  it('режим, выбранный руками, сильнее предложенного', () => {
    const r = buildQuickResult(
      { ...f, modeId: 'vulnerable_child' },
      bodyChips,
      CASE_IMPULSES,
    );
    expect(r.modeId).toBe('vulnerable_child');
  });

  it('запись дневника: fromCase, чувство, тело и порывы словами', () => {
    const d = buildQuickSaveData(f, bodyChips, CASE_IMPULSES);
    expect(d).toMatchObject({
      modeId: 'avoidant_protector',
      situation: 'Она ответила одним словом',
      feelings: 'Страшно, тревожно',
      fromCase: true,
    });
    expect(d.actions).toContain('исчезнуть');
    expect(d.bodyFeelings).toBeTruthy();
  });

  it('без тела и порывов поля undefined, а не пустые строки', () => {
    const d = buildQuickSaveData(fields(), bodyChips, CASE_IMPULSES);
    expect(d.bodyFeelings).toBeUndefined();
    expect(d.actions).toBeUndefined();
  });

  it('карточка режима: сцена, тело, порыв', () => {
    const c = buildQuickCardBody(f, bodyChips, CASE_IMPULSES);
    expect(c.modeId).toBe('avoidant_protector');
    expect(c.triggers).toBe('Она ответила одним словом');
    expect(c.behavior).toContain('исчезнуть');
    expect(c.alias).toBeUndefined();
  });

  it('ровный день: Здоровый Взрослый, ворота «Спокойно, хорошо», fromCase', () => {
    expect(buildSteadySaveData(' тихий вечер ')).toEqual({
      modeId: STEADY_MODE_ID,
      situation: 'тихий вечер',
      feelings: 'Спокойно, хорошо',
      fromCase: true,
    });
  });
});
