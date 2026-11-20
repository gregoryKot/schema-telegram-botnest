import { describe, expect, it } from 'vitest';
import type { TechniqueGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { betweenRubricSeed, betweenSeed, channelSeed, planDraft, sessionSeed } from './guidePlan';

describe('guidePlan — заготовка пункта плана из статьи справочника', () => {
  it('направление «Как работать»: рубрика и поле — ключ направления, текст по предложениям', () => {
    const seed = channelSeed('cognitive', 'Оценить риск [Арнтц, 5.1.1]. Потом — за и против.');
    expect(seed).toMatchObject({ rubric: 'cognitive', field: 'cognitive', label: 'Когнитивные (через понимание)' });
    expect(seed.parts).toEqual(['Оценить риск [Арнтц, 5.1.1].', 'Потом — за и против.']);
  });

  it('«На сессии»: по части на технику', () => {
    const techniques = [{ name: 'Рескриптинг' }, { name: 'Работа со стульями' }] as TechniqueGuide[];
    expect(sessionSeed(techniques)).toMatchObject({ rubric: 'session', parts: ['Рескриптинг', 'Работа со стульями'] });
  });

  it('«Между сессиями»: название первой частью, дальше пояснение; без пояснения — одно название', () => {
    expect(betweenSeed({ kind: 'custom', title: 'Письмо себе', text: 'Написать письмо. Прочитать вслух.' }).parts)
      .toEqual(['Письмо себе', 'Написать письмо.', 'Прочитать вслух.']);
    expect(betweenSeed({ kind: 'task', type: 'mode_card' as never, title: 'Карточка режима' }).parts).toEqual(['Карточка режима']);
  });

  it('рубрика «Между сессиями» целиком: по части на название пункта', () => {
    const seed = betweenRubricSeed([{ kind: 'custom', title: 'Письмо себе', text: 'Написать письмо.' }, { kind: 'task', type: 'mode_card' as never, title: 'Карточка режима' }]);
    expect(seed).toMatchObject({ rubric: 'between', field: 'betweenSessions', label: 'Между сессиями', parts: ['Письмо себе', 'Карточка режима'] });
  });

  it('заготовка помнит статью: вид, id и поле', () => {
    const draft = planDraft(channelSeed('behavioral', 'Договориться.'), { kind: 'mode', id: 'bully_attack' });
    expect(draft.source).toEqual({ kind: 'mode', id: 'bully_attack', field: 'behavioral' });
  });
});
