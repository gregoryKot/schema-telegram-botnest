import { describe, it, expect } from 'vitest';
import {
  asCaseGateId,
  gateIdForMode,
  chipLabels,
  buildAnswers,
  toSaveData,
  toCardBody,
} from './caseFlowMappers';
import { INITIAL_CASE_FIELDS, type CaseFlowFields } from './caseFlowTypes';
import type { RecognitionView } from './caseRecognition';

describe('asCaseGateId', () => {
  it('пропускает известный id как есть', () => {
    expect(asCaseGateId('fear')).toBe('fear');
  });
  it('null уходит в unknown — защитная страховка', () => {
    expect(asCaseGateId(null)).toBe('unknown');
  });
});

describe('gateIdForMode', () => {
  it('находит ворота по modeId, выбранному в обход шага gate', () => {
    expect(gateIdForMode('vulnerable_child')).not.toBe('unknown');
  });
  it('режим вне реестра не роняет функцию — unknown', () => {
    expect(gateIdForMode('not_a_real_mode_id')).toBe('unknown');
  });
});

describe('chipLabels', () => {
  const chips = [
    { id: 'a', label: 'Ай' },
    { id: 'b', label: 'Би' },
  ];
  it('сохраняет порядок ids, а не порядок чипов', () => {
    expect(chipLabels(chips, ['b', 'a'])).toEqual(['Би', 'Ай']);
  });
  it('неизвестный id молча пропускается', () => {
    expect(chipLabels(chips, ['a', 'ghost'])).toEqual(['Ай']);
  });
});

function fields(overrides: Partial<CaseFlowFields> = {}): CaseFlowFields {
  return { ...INITIAL_CASE_FIELDS, ...overrides };
}

describe('buildAnswers', () => {
  it('null gateId уходит в unknown — CaseAnswers.gateId обязателен', () => {
    const a = buildAnswers(fields({ scene: 'сцена', modeId: 'x' }));
    expect(a.gateId).toBe('unknown');
    expect(a.scene).toBe('сцена');
    expect(a.modeId).toBe('x');
  });
});

const recognition: RecognitionView = {
  chain: {
    scene: 'Сцена целиком',
    body: 'сердце колотится',
    impulse: 'свернуть разговор',
  },
  termParagraph: null,
  verdictReply: '',
  clinicalName: 'Уязвимый Ребёнок',
  traits: {
    body: 'сердце колотится',
    trigger: 'Сцена целиком',
    impulse: 'свернуть разговор',
  },
};

describe('toSaveData', () => {
  it('маппит из recognition, не из сырых полей', () => {
    const data = toSaveData(
      fields({ modeId: 'vulnerable_child' }),
      recognition,
    );
    expect(data).toEqual({
      modeId: 'vulnerable_child',
      situation: 'Сцена целиком',
      bodyFeelings: 'сердце колотится',
      actions: 'свернуть разговор',
    });
  });

  it('пустые traits дают undefined, а не пустую строку', () => {
    const empty: RecognitionView = {
      ...recognition,
      traits: { body: '', trigger: 'T', impulse: '' },
    };
    const data = toSaveData(fields({ modeId: 'x' }), empty);
    expect(data.bodyFeelings).toBeUndefined();
    expect(data.actions).toBeUndefined();
  });
});

describe('toCardBody', () => {
  it('обрезает alias и подставляет undefined для пустого', () => {
    const body = toCardBody(
      'vulnerable_child',
      '  Стена  ',
      recognition.traits,
    );
    expect(body.alias).toBe('Стена');
    const skipped = toCardBody('vulnerable_child', '   ', recognition.traits);
    expect(skipped.alias).toBeUndefined();
  });

  it('пустые traits дают undefined для triggers/feelings/behavior, не пустую строку', () => {
    const body = toCardBody('vulnerable_child', 'Стена', {
      body: '',
      trigger: '',
      impulse: '',
    });
    expect(body.triggers).toBeUndefined();
    expect(body.feelings).toBeUndefined();
    expect(body.behavior).toBeUndefined();
  });
});
