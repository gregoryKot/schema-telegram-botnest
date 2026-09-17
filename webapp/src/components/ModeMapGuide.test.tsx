// @vitest-environment jsdom
// ModeMapGuide — панель подсказок карты режимов (0% покрытия). Шаги/чекмарки
// вычисляются из фактического набора узлов на холсте — тестируем именно
// эту связку «узлы на холсте → отмеченный шаг», а не только рендер вёрстки.
// Никакого canvas здесь нет (это side-панель, не сам холст).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeMapGuide } from './ModeMapGuide';
import type { FlowNode } from './modeMapFlow';
import { AddressFormContext } from '../utils/addressForm';

afterEach(() => {
  cleanup();
});

function node(type: string, data: Record<string, unknown> = {}): FlowNode {
  return { id: `${type}-${Math.random()}`, type, position: { x: 0, y: 0 }, data: { label: type, ...data } };
}

function renderGuide(props: Partial<Parameters<typeof ModeMapGuide>[0]> = {}) {
  return render(
    <ModeMapGuide
      nodes={[]}
      kind="problem"
      onAdd={vi.fn()}
      onOpenNeed={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );
}

describe('ModeMapGuide — шаги «problem»', () => {
  it('без узлов ни один шаг не отмечен галочкой', () => {
    renderGuide({ nodes: [] });
    expect(screen.getByText('1. Триггер')).toBeTruthy();
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('добавленный узел trigger отмечает соответствующий шаг ✓', () => {
    renderGuide({ nodes: [node('trigger')] });
    const btn = screen.getByText('1. Триггер').closest('button')!;
    expect(btn.textContent).toContain('✓');
  });

  it('клик по невыполненному шагу зовёт onAdd с узлом нужного типа', () => {
    const onAdd = vi.fn();
    renderGuide({ nodes: [], onAdd });
    fireEvent.click(screen.getByText('1. Триггер').closest('button')!);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'trigger' }));
  });

  it('шаг «Потребность» кликабелен только когда уже есть Уязвимый Ребёнок', () => {
    const onOpenNeed = vi.fn();
    renderGuide({ nodes: [], onOpenNeed });
    const needBtn = screen.getByText('6. Потребность').closest('button') as HTMLButtonElement;
    expect(needBtn.disabled).toBe(true);
    fireEvent.click(needBtn);
    expect(onOpenNeed).not.toHaveBeenCalled();
  });

  it('с добавленным Уязвимым Ребёнком шаг «Потребность» становится кликабельным', () => {
    const onOpenNeed = vi.fn();
    renderGuide({ nodes: [node('child')], onOpenNeed });
    const needBtn = screen.getByText('6. Потребность').closest('button') as HTMLButtonElement;
    expect(needBtn.disabled).toBe(false);
    fireEvent.click(needBtn);
    expect(onOpenNeed).toHaveBeenCalled();
  });
});

describe('ModeMapGuide — шаги «couple» и «identity»', () => {
  it('kind=couple показывает шаги с пометкой партнёра А/Б', () => {
    renderGuide({ kind: 'couple' });
    expect(screen.getByText('Цикл-клэш пары')).toBeTruthy();
    expect(screen.getByText('1. Триггер')).toBeTruthy();
    expect(screen.getByText('5. Копинг Б → бьёт по А')).toBeTruthy();
  });

  it('kind=identity показывает карту личности с группами режимов', () => {
    renderGuide({ kind: 'identity' as never });
    expect(screen.getByText('Карта личности')).toBeTruthy();
    expect(screen.getByText('1. Детские режимы')).toBeTruthy();
  });
});

describe('ModeMapGuide — контекстные алерты', () => {
  it('больше 12 узлов на карте — предупреждение «многовато режимов»', () => {
    const nodes = Array.from({ length: 13 }, () => node('trigger'));
    renderGuide({ nodes });
    expect(screen.getByText(/Многовато режимов/)).toBeTruthy();
  });

  it('есть копинг без Уязвимого Ребёнка — подсказка искать боль под копингом', () => {
    renderGuide({ nodes: [node('coping')] });
    expect(screen.getByText(/За копингом обычно прячется боль/)).toBeTruthy();
  });

  it('на чистой карте (нет узлов) алертов нет вообще', () => {
    renderGuide({ nodes: [] });
    expect(screen.queryByText(/Многовато режимов/)).toBeNull();
    expect(screen.queryByText(/За копингом обычно прячется боль/)).toBeNull();
  });
});

describe('ModeMapGuide — советы и закрытие', () => {
  it('показывает 3 случайных совета из базы знаний', () => {
    renderGuide();
    expect(screen.getByText('Советы')).toBeTruthy();
  });

  it('кнопка «↻» перегенерирует советы без падений', () => {
    renderGuide();
    expect(() => fireEvent.click(screen.getByLabelText('Другие советы'))).not.toThrow();
  });

  it('кнопка закрытия зовёт onClose', () => {
    const onClose = vi.fn();
    renderGuide({ onClose });
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ModeMapGuide — обращение ты/вы (правило CLAUDE.md, терапевт — тоже пользователь формы)', () => {
  it('форма «вы»: подсказка цикл-клэша, алерт и шаг «Потребность» звучат на «вы», без «ты»', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
        <ModeMapGuide
          nodes={[node('child'), node('coping')]}
          kind="problem"
          onAdd={vi.fn()}
          onOpenNeed={vi.fn()}
          onClose={vi.fn()}
        />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByText('Назовите потребность ребёнка — именно она становится целью терапии.')).toBeTruthy();
    expect(screen.queryByText(/Назови потребность/)).toBeNull();
  });

  it('форма «ты» (по умолчанию): те же строки звучат на «ты»', () => {
    renderGuide({ nodes: [node('child'), node('coping')], kind: 'problem' });
    expect(screen.getByText('Назови потребность ребёнка — именно она становится целью терапии.')).toBeTruthy();
    expect(screen.queryByText(/Назовите потребность/)).toBeNull();
  });
});
