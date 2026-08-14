import {
  classifyClientErrorSection,
  CLIENT_ERROR_SECTIONS,
} from './client-error-section';

describe('classifyClientErrorSection', () => {
  it('маппит все известные литералы обоих фронтендов в свои бакеты', () => {
    expect(classifyClientErrorSection('auth')).toBe('auth');
    expect(classifyClientErrorSection('today.tasks')).toBe('today');
    expect(classifyClientErrorSection('practice.tasks')).toBe('practice');
    expect(classifyClientErrorSection('Сегодня')).toBe('today');
    expect(classifyClientErrorSection('Дневник')).toBe('diary');
    expect(classifyClientErrorSection('Паттерны')).toBe('schemas');
    expect(classifyClientErrorSection('Практика')).toBe('practice');
    expect(classifyClientErrorSection('Практики')).toBe('practice');
    expect(classifyClientErrorSection('Профиль')).toBe('profile');
    expect(classifyClientErrorSection('Помощь')).toBe('help');
    expect(classifyClientErrorSection('Кабинет')).toBe('cabinet');
  });

  it('незнакомая секция — other, а не отброшена/не падает', () => {
    expect(classifyClientErrorSection('НовыйЭкранБезРегистрации')).toBe(
      'other',
    );
    expect(classifyClientErrorSection('')).toBe('other');
  });

  it('произвольный текст с клиента (эндпоинт без auth-гарда) тоже — other', () => {
    // Инвариант: раз эндпоинт публичный, section — не доверенное поле,
    // и любая строка не из белого списка обязана схлопнуться в бакет,
    // а не попасть в meta как есть (правило №7 — meta только структурная).
    expect(classifyClientErrorSection('<script>alert(1)</script>')).toBe(
      'other',
    );
    expect(classifyClientErrorSection('  auth  ')).toBe('auth'); // trim
  });

  it('каждый бакет из результата — элемент CLIENT_ERROR_SECTIONS', () => {
    const inputs = ['auth', 'today.tasks', 'Дневник', 'что угодно ещё'];
    for (const input of inputs) {
      expect(CLIENT_ERROR_SECTIONS).toContain(
        classifyClientErrorSection(input),
      );
    }
  });
});
