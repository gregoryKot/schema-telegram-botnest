// @vitest-environment jsdom
// ResultPhase — итог колеса детства (0% покрытия): заголовок в форме ты/вы,
// легенда с реальными значениями, подсказки схем для просевших потребностей
// (клик по схеме открывает её описание), «хорошее детство» при всех >4,
// и кнопки навигации (Изменить/Готово/Подробнее о схемах).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { ResultPhase } from './ResultPhase';
import { buildNeedMeta } from './needMeta';
import type { ActiveSchema, Ratings } from './types';

const NEED_META = buildNeedMeta((ty) => ty);

function renderWithForm(ui: ReactElement, form: AddressForm = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

function ratings(overrides: Partial<Ratings> = {}): Ratings {
  return {
    attachment: 8,
    autonomy: 8,
    expression: 8,
    play: 8,
    limits: 8,
    ...overrides,
  };
}

afterEach(cleanup);

describe('ResultPhase — заголовок по форме обращения', () => {
  it('форма «ты» — «Твоё колесо детства»', () => {
    renderWithForm(
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings()}
        onEdit={() => {}}
        onDone={() => {}}
        onOpenSchemas={() => {}}
        setActiveSchema={() => {}}
      />,
      'ty',
    );
    expect(screen.getByText('Твоё колесо детства')).toBeTruthy();
  });

  it('форма «вы» — «Ваше колесо детства»', () => {
    renderWithForm(
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings()}
        onEdit={() => {}}
        onDone={() => {}}
        onOpenSchemas={() => {}}
        setActiveSchema={() => {}}
      />,
      'vy',
    );
    expect(screen.getByText('Ваше колесо детства')).toBeTruthy();
  });
});

describe('ResultPhase — легенда значений', () => {
  it('показывает реальные оценки пользователя для всех 5 потребностей', () => {
    // Значение дублируется и в SVG-колесе (подпись у точки), и в текстовой
    // легенде под ним — matcher нацелен именно на <span> легенды, не на <text> SVG.
    renderWithForm(
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings({ attachment: 3, autonomy: 9 })}
        onEdit={() => {}}
        onDone={() => {}}
        onOpenSchemas={() => {}}
        setActiveSchema={() => {}}
      />,
    );
    expect(screen.getByText('3', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('9', { selector: 'span' })).toBeTruthy();
  });
});

describe('ResultPhase — низкие потребности → подсказки схем', () => {
  it('потребность ≤4 показывает домен и список схем с подсказкой «в детстве»', () => {
    renderWithForm(
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings({ attachment: 2 })}
        onEdit={() => {}}
        onDone={() => {}}
        onOpenSchemas={() => {}}
        setActiveSchema={() => {}}
      />,
    );
    expect(screen.getByText('Возможные активные схемы')).toBeTruthy();
    expect(screen.getByText('Домен: Отчуждение и отвержение')).toBeTruthy();
    expect(screen.getByText('Покинутость / Нестабильность')).toBeTruthy();
    expect(screen.getByText('2/10 в детстве')).toBeTruthy();
  });

  it('клик по схеме с реальными данными открывает её через setActiveSchema', () => {
    const setActiveSchema = vi.fn();
    renderWithForm(
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings({ attachment: 2 })}
        onEdit={() => {}}
        onDone={() => {}}
        onOpenSchemas={() => {}}
        setActiveSchema={setActiveSchema}
      />,
    );
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(setActiveSchema).toHaveBeenCalledTimes(1);
    const arg = setActiveSchema.mock.calls[0][0] as ActiveSchema;
    expect(arg.name).toBe('Покинутость / Нестабильность');
  });

  it('«Подробнее о схемах» зовёт onDone и onOpenSchemas', () => {
    const onDone = vi.fn();
    const onOpenSchemas = vi.fn();
    renderWithForm(
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings({ attachment: 2 })}
        onEdit={() => {}}
        onDone={onDone}
        onOpenSchemas={onOpenSchemas}
        setActiveSchema={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Подробнее о схемах'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onOpenSchemas).toHaveBeenCalledTimes(1);
  });

  it('нет ни одной потребности ≤4 — вместо подсказок «Хорошее детство по всем зонам»', () => {
    renderWithForm(
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings()}
        onEdit={() => {}}
        onDone={() => {}}
        onOpenSchemas={() => {}}
        setActiveSchema={() => {}}
      />,
    );
    expect(screen.getByText('Хорошее детство по всем зонам')).toBeTruthy();
    expect(screen.queryByText('Возможные активные схемы')).toBeNull();
  });
});

describe('ResultPhase — навигация', () => {
  it('«Изменить» зовёт onEdit', () => {
    const onEdit = vi.fn();
    renderWithForm(
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings()}
        onEdit={onEdit}
        onDone={() => {}}
        onOpenSchemas={() => {}}
        setActiveSchema={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('✎ Изменить'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('«Готово» зовёт onDone', () => {
    const onDone = vi.fn();
    renderWithForm(
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings()}
        onEdit={() => {}}
        onDone={onDone}
        onOpenSchemas={() => {}}
        setActiveSchema={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Готово'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
