// @vitest-environment jsdom
// Пустой архив дневника — объяснение «что это и зачем» для новичка (правило
// онбординга CLAUDE.md). Проверяем ветвление по фильтру и отсутствие
// «ты»-форм в «вы»-режиме (парный тест мини-аппа — DiaryEmptyExplainer там).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { DiaryEmptyExplainer } from './DiaryEmptyExplainer';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

describe('DiaryEmptyExplainer (webapp) — пустой архив объясняет «зачем»', () => {
  it('фильтр «Все»: общий зачин и карточки схем и режимов', () => {
    const { container } = renderWithForm(
      <DiaryEmptyExplainer filter="all" />,
      'ty',
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Пока ни одной записи');
    expect(text).toContain('главный инструмент схема-терапии');
    expect(text).toContain('Схема —'); // что такое схема
    expect(text).toContain('Режим —'); // что такое режим
    expect(text).toContain('3–5 записей'); // результат и срок
  });

  it('фильтр по типу: только его карточка, честное «нет записей»', () => {
    const { container } = renderWithForm(
      <DiaryEmptyExplainer filter="mode" />,
      'ty',
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Нет записей этого типа');
    expect(text).toContain('Режим —');
    expect(text).not.toContain('Схема —');
  });

  it('форма «вы»: без «ты»-форм во всех фильтрах', () => {
    for (const filter of ['all', 'schema', 'mode', 'gratitude'] as const) {
      const { container, unmount } = renderWithForm(
        <DiaryEmptyExplainer filter={filter} />,
        'vy',
      );
      expect(hasTyForms(container.textContent ?? '')).toBe(false);
      unmount();
    }
  });
});
