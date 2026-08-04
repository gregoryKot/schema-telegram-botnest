// @vitest-environment jsdom
// Пустые состояния дневников — объяснение «что это и зачем» для новичка
// (правило онбординга CLAUDE.md). Проверяем: контент отвечает на оба вопроса,
// вилка ты/вы реально работает, в «вы»-режиме не протекают «ты»-формы
// (грep-свип из правила про обращение).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { DiaryEmptyExplainer } from './DiaryEmptyExplainer';
import { DiaryHubIntro } from './DiaryHubIntro';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

describe('DiaryEmptyExplainer — «что это и зачем» до первой записи', () => {
  it('называет источник (схема-терапия) и результат со сроком', () => {
    for (const type of ['schema', 'mode'] as const) {
      const { container, unmount } = renderWithForm(
        <DiaryEmptyExplainer type={type} />,
        'ty',
      );
      const text = container.textContent ?? '';
      expect(text).toContain('схема-терапи'); // откуда это
      expect(text).toContain('3–5 записей'); // зачем: результат и срок
      unmount();
    }
  });

  it('форма «вы»: ни одной «ты»-формы ни в одном дневнике', () => {
    for (const type of ['schema', 'mode', 'gratitude'] as const) {
      const { container, unmount } = renderWithForm(
        <DiaryEmptyExplainer type={type} />,
        'vy',
      );
      expect(hasTyForms(container.textContent ?? '')).toBe(false);
      unmount();
    }
  });

  it('вилка ты/вы действительно меняет текст', () => {
    const ty = renderWithForm(<DiaryEmptyExplainer type="mode" />, 'ty')
      .container.textContent;
    cleanup();
    const vy = renderWithForm(<DiaryEmptyExplainer type="mode" />, 'vy')
      .container.textContent;
    expect(ty).not.toEqual(vy);
  });
});

describe('DiaryHubIntro — зачин хаба дневников', () => {
  it('без записей объясняет, что дневник — инструмент схема-терапии', () => {
    const { container } = renderWithForm(<DiaryHubIntro empty />, 'ty');
    expect(container.textContent).toContain('схема-терапи');
    expect(container.textContent).toContain('3–5 записей');
  });

  // Когда дневник уже начат, объяснение уходит совсем: его работу дальше
  // делают подзаголовок хаба и мета-строки записей, а лишний абзац только
  // отодвигает главное действие вниз.
  it('с записями подводки нет вовсе', () => {
    const { container } = renderWithForm(<DiaryHubIntro empty={false} />, 'ty');
    expect(container.textContent).toBe('');
  });

  it('форма «вы»: обе ветки без «ты»-форм', () => {
    for (const empty of [true, false]) {
      const { container, unmount } = renderWithForm(
        <DiaryHubIntro empty={empty} />,
        'vy',
      );
      expect(hasTyForms(container.textContent ?? '')).toBe(false);
      unmount();
    }
  });
});
