// @vitest-environment jsdom
// PatternsHero — hero вкладки «Схемы» (0% покрытия). Три ветки экрана
// (новичок без схем / есть недельная сводка / есть схемы, но сводки нет) и
// обращение ты/вы в подписях — типичная точка расхождения при правках текста.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';
import { PatternsHero } from './PatternsHero';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

const baseProps = {
  onStartTest: vi.fn(),
  onOpenLibrary: vi.fn(),
  onPickManually: vi.fn(),
  onOpenSchemaDetail: vi.fn(),
};

describe('PatternsHero — новичок (нет отмеченных схем)', () => {
  it('показывает CTA «Начать тест» без прогресса', () => {
    render(
      <PatternsHero
        {...baseProps}
        hasSchemas={false}
        summary={null}
        progressAnswered={null}
        onStartTest={vi.fn()}
      />,
    );
    expect(screen.getByText('Узнать свои схемы')).toBeTruthy();
    expect(screen.getByText('Начать тест')).toBeTruthy();
  });

  it('есть незаконченный прогресс теста — кнопка предлагает продолжить', () => {
    render(
      <PatternsHero
        {...baseProps}
        hasSchemas={false}
        summary={null}
        progressAnswered={42}
      />,
    );
    expect(screen.getByText('Продолжить тест (42 из 116)')).toBeTruthy();
  });

  it('клик по CTA зовёт onStartTest', () => {
    const onStartTest = vi.fn();
    render(
      <PatternsHero
        {...baseProps}
        hasSchemas={false}
        summary={null}
        onStartTest={onStartTest}
      />,
    );
    fireEvent.click(screen.getByText('Узнать свои схемы'));
    expect(onStartTest).toHaveBeenCalled();
  });
});

describe('PatternsHero — есть недельная сводка', () => {
  it('показывает карточку схемы из summary и открывает деталь по клику', () => {
    const onOpenSchemaDetail = vi.fn();
    render(
      <PatternsHero
        {...baseProps}
        hasSchemas
        summary={{ id: 'emotional_deprivation', days: 4, windowDays: 7 }}
        onOpenSchemaDetail={onOpenSchemaDetail}
      />,
    );
    expect(screen.getByText('Чаще всего звучит')).toBeTruthy();
    fireEvent.click(screen.getByText('Чаще всего звучит'));
    expect(onOpenSchemaDetail).toHaveBeenCalledWith('emotional_deprivation');
  });

  it('неизвестный id в summary — компонент не падает, рендерит null', () => {
    const { container } = render(
      <PatternsHero
        {...baseProps}
        hasSchemas
        summary={{ id: 'not_a_real_schema', days: 1, windowDays: 7 }}
      />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('PatternsHero — есть схемы, но сводки нет', () => {
  it('без onOpenDiaries — рендерит null (ничего не падает)', () => {
    const { container } = render(
      <PatternsHero {...baseProps} hasSchemas summary={null} />,
    );
    expect(container.textContent).toBe('');
  });

  it('с onOpenDiaries — предлагает пойти в дневник', () => {
    const onOpenDiaries = vi.fn();
    render(
      <PatternsHero
        {...baseProps}
        hasSchemas
        summary={null}
        onOpenDiaries={onOpenDiaries}
      />,
    );
    fireEvent.click(screen.getByText('Картина недели появится из дневника'));
    expect(onOpenDiaries).toHaveBeenCalled();
  });
});

describe('PatternsHero — обращение ты/вы', () => {
  it('форма «ты»', () => {
    renderWithForm(
      <PatternsHero {...baseProps} hasSchemas={false} summary={null} />,
      'ty',
    );
    expect(screen.getByText(/включаются у тебя чаще всего/)).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <PatternsHero {...baseProps} hasSchemas={false} summary={null} />,
      'vy',
    );
    expect(screen.getByText(/включаются у вас чаще всего/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
