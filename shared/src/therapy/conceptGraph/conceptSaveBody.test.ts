import { describe, it, expect } from 'vitest';
import { conceptSaveBody } from './conceptSaveBody';
import { emptyModeLink } from './modeLinks';

describe('conceptSaveBody', () => {
  it('пустой ввод — все умолчания: пустые массивы и строки, modeLinks []', () => {
    expect(conceptSaveBody({})).toEqual({
      schemaIds: [],
      modeIds: [],
      earlyExperience: '',
      unmetNeeds: '',
      triggers: '',
      copingStyles: '',
      goals: '',
      currentProblems: '',
      modeTransitions: '',
      modeLinks: [],
    });
  });

  it('null в текстовых полях (ответ сервера) становится пустой строкой', () => {
    const body = conceptSaveBody({
      goals: null,
      triggers: null,
      unmetNeeds: 'х',
    });
    expect(body.goals).toBe('');
    expect(body.triggers).toBe('');
    expect(body.unmetNeeds).toBe('х');
  });

  it('значения проходят как есть', () => {
    const body = conceptSaveBody({
      schemaIds: ['failure'],
      modeIds: ['vulnerable_child'],
      earlyExperience: 'a',
      copingStyles: 'b',
      currentProblems: 'c',
      modeTransitions: 'd',
    });
    expect(body).toMatchObject({
      schemaIds: ['failure'],
      modeIds: ['vulnerable_child'],
      earlyExperience: 'a',
      copingStyles: 'b',
      currentProblems: 'c',
      modeTransitions: 'd',
    });
  });

  it('modeLinks нормализуется: мусор и дубли не уходят на сервер', () => {
    const body = conceptSaveBody({
      modeLinks: [
        { ...emptyModeLink('m'), alias: 'Судья' },
        { ...emptyModeLink('m'), alias: 'дубль' },
        { alias: 'без id' } as never,
        null as never,
      ],
    });
    expect(body.modeLinks).toEqual([{ ...emptyModeLink('m'), alias: 'Судья' }]);
  });
});
