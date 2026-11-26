// Очередь входов кабинета (QA 2026-11, A-З7): один слой за раз, вопрос «ты/вы»
// первым — до согласий, которые без него звучали на «ты».
import { describe, it, expect } from 'vitest';
import { entryStep } from './entryQueue';

const base = { addressDone: true, consent: 'done' as const, linkHandled: true, join: false };

describe('entryStep', () => {
  it('вопрос «ты/вы» раньше всего, даже если согласия ещё нужны', () => {
    expect(entryStep({ ...base, addressDone: false, consent: 'needed' })).toBe('address');
    expect(entryStep({ ...base, addressDone: false, consent: 'checking' })).toBe('address');
  });

  it('после вопроса — согласия; пока их проверяют, на экране ничего', () => {
    expect(entryStep({ ...base, consent: 'needed', linkHandled: false })).toBe('consent');
    expect(entryStep({ ...base, consent: 'checking', linkHandled: false })).toBe('wait');
  });

  it('ссылка разбирается после согласий; пока не разобрана — очередь не кончилась', () => {
    expect(entryStep({ ...base, linkHandled: false })).toBe('wait');
    expect(entryStep({ ...base, join: true })).toBe('join');
  });

  it('всё решено — конец очереди', () => {
    expect(entryStep(base)).toBe('done');
  });
});
