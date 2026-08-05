// @vitest-environment jsdom
// ModesTab — вкладка «Режимы» справочника (0% покрытия, 403 строки). Три
// связанных куска: список режимов по группам, чек-ин «как ты сейчас»
// (выбор → результат с советом → закрытие сбрасывает ОБА состояния разом —
// иначе повторное открытие чек-ина сразу показывало бы старый результат) и
// шеринг карточки режима. ShareCardSheet рисует canvas — мокаем, как в
// SchemaDetailSheet.test.tsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModesTab } from './ModesTab';

vi.mock('../../share/ShareCardSheet', () => ({
  ShareCardSheet: ({
    title,
    onClose,
  }: {
    title: string;
    onClose: () => void;
  }) => (
    <div data-testid="share-card-sheet">
      {title}
      <button onClick={onClose}>share-card-close</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('ModesTab — список режимов', () => {
  it('рендерит группы и режимы с описанием', () => {
    render(<ModesTab />);
    expect(screen.getByText('Детские режимы')).toBeTruthy();
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getByText(/Базовый режим боли/)).toBeTruthy();
  });
});

describe('ModesTab — чек-ин «как ты сейчас»', () => {
  it('клик по виджету открывает селектор чувств', () => {
    render(<ModesTab />);
    fireEvent.click(screen.getByText('Режим прямо сейчас'));
    expect(screen.getByText('Как ты сейчас?')).toBeTruthy();
    expect(screen.getByText('Одиноко / страшно')).toBeTruthy();
  });

  it('Enter на виджете тоже открывает селектор (доступность с клавиатуры)', () => {
    render(<ModesTab />);
    fireEvent.keyDown(screen.getByText('Режим прямо сейчас'), { key: 'Enter' });
    expect(screen.getByText('Как ты сейчас?')).toBeTruthy();
  });

  it('выбор чувства показывает карточку результата с названием режима и советом', () => {
    render(<ModesTab />);
    fireEvent.click(screen.getByText('Режим прямо сейчас'));
    fireEvent.click(screen.getByText('Одиноко / страшно'));
    // «Уязвимый Ребёнок» есть и в списке режимов позади, и в карточке
    // результата — проверяем, что их стало (минимум) два, а совет уникален.
    expect(
      screen.getAllByText('Уязвимый Ребёнок').length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Найди что-то тёплое/)).toBeTruthy();
    // Селектор закрылся — заголовок выбора чувства больше не виден.
    expect(screen.queryByText('Как ты сейчас?')).toBeNull();
  });

  it('«Понятно» закрывает результат и снова открывает виджет с нуля (не залипает на старом ответе)', () => {
    render(<ModesTab />);
    fireEvent.click(screen.getByText('Режим прямо сейчас'));
    fireEvent.click(screen.getByText('Одиноко / страшно'));
    fireEvent.click(screen.getByText('Понятно'));
    expect(screen.queryByText(/Найди что-то тёплое/)).toBeNull();

    fireEvent.click(screen.getByText('Режим прямо сейчас'));
    expect(screen.getByText('Как ты сейчас?')).toBeTruthy();
  });

  it('клик по фону оверлея селектора закрывает его без выбора', () => {
    render(<ModesTab />);
    fireEvent.click(screen.getByText('Режим прямо сейчас'));
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(screen.queryByText('Как ты сейчас?')).toBeNull();
  });
});

describe('ModesTab — шеринг карточки режима', () => {
  it('клик по «Поделиться» у режима открывает ShareCardSheet с нужным заголовком', () => {
    render(<ModesTab />);
    const pill = screen.getAllByLabelText('Поделиться')[0];
    fireEvent.click(pill);
    expect(screen.getByTestId('share-card-sheet')).toBeTruthy();
    expect(screen.getByText('Карточка режима')).toBeTruthy();
  });

  it('закрытие ShareCardSheet убирает его из DOM', () => {
    render(<ModesTab />);
    fireEvent.click(screen.getAllByLabelText('Поделиться')[0]);
    fireEvent.click(screen.getByText('share-card-close'));
    expect(screen.queryByTestId('share-card-sheet')).toBeNull();
  });
});
