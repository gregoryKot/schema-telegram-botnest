// @vitest-environment jsdom
// ModesHero — hero вкладки «Режимы» (0% покрытия), зеркало PatternsHero.
// Те же три ветки + ты/вы; отдельный тест, т.к. это разные схемы данных
// (ALL_MODES/MODE_GROUPS вместо SCHEMA_DOMAINS) — баг в одной ветке не
// гарантированно повторяется в другой.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';
import { ModesHero } from './ModesHero';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

const baseProps = {
  onMeetCritic: vi.fn(),
  onOpenLibrary: vi.fn(),
  onPickManually: vi.fn(),
  onOpenModeDetail: vi.fn(),
};

describe('ModesHero — новичок (нет отмеченных режимов)', () => {
  it('показывает CTA знакомства с Критиком', () => {
    render(<ModesHero {...baseProps} hasModes={false} summary={null} />);
    expect(screen.getByText('Встретить своего Критика')).toBeTruthy();
  });

  it('клик по CTA зовёт onMeetCritic', () => {
    const onMeetCritic = vi.fn();
    render(
      <ModesHero
        {...baseProps}
        hasModes={false}
        summary={null}
        onMeetCritic={onMeetCritic}
      />,
    );
    fireEvent.click(screen.getByText('Встретить своего Критика'));
    expect(onMeetCritic).toHaveBeenCalled();
  });
});

describe('ModesHero — есть недельная сводка', () => {
  it('показывает карточку режима и открывает деталь по клику', () => {
    const onOpenModeDetail = vi.fn();
    render(
      <ModesHero
        {...baseProps}
        hasModes
        summary={{ id: 'vulnerable_child', days: 3, windowDays: 7 }}
        onOpenModeDetail={onOpenModeDetail}
      />,
    );
    expect(screen.getByText('Чаще всего включается')).toBeTruthy();
    fireEvent.click(screen.getByText('Чаще всего включается'));
    expect(onOpenModeDetail).toHaveBeenCalledWith('vulnerable_child');
  });

  it('неизвестный id в summary — не падает, рендерит null', () => {
    const { container } = render(
      <ModesHero
        {...baseProps}
        hasModes
        summary={{ id: 'not_a_real_mode', days: 1, windowDays: 7 }}
      />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('ModesHero — есть режимы, но сводки нет', () => {
  it('без onOpenDiaries — рендерит null', () => {
    const { container } = render(
      <ModesHero {...baseProps} hasModes summary={null} />,
    );
    expect(container.textContent).toBe('');
  });

  it('с onOpenDiaries — предлагает пойти в дневник', () => {
    const onOpenDiaries = vi.fn();
    render(
      <ModesHero
        {...baseProps}
        hasModes
        summary={null}
        onOpenDiaries={onOpenDiaries}
      />,
    );
    fireEvent.click(screen.getByText('Картина недели появится из дневника'));
    expect(onOpenDiaries).toHaveBeenCalled();
  });
});

describe('ModesHero — обращение ты/вы', () => {
  it('форма «ты»', () => {
    renderWithForm(
      <ModesHero {...baseProps} hasModes={false} summary={null} />,
      'ty',
    );
    expect(screen.getByText(/Начни с самого узнаваемого/)).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <ModesHero {...baseProps} hasModes={false} summary={null} />,
      'vy',
    );
    expect(screen.getByText(/Начните с самого узнаваемого/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
