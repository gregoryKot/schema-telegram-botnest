// @vitest-environment jsdom
// SchemaInfoSheet — «Как это работает» (0% покрытия): переключение вкладок
// (уже покрыты NeedsTab/SchemasTab/ModesTab — мокаем), баннер незаконченного
// теста читает реальный localStorage (не выдуманное состояние), и «Открыть
// схемы» из ModesTab/список схем корректно передаёт highlight в SchemasTab.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaInfoSheet, SchemaInfoContent } from './SchemaInfoSheet';

vi.mock('./schemaInfoSheet/NeedsTab', () => ({
  NeedsTab: () => <div data-testid="needs-tab">needs-tab</div>,
}));
vi.mock('./schemaInfoSheet/SchemasTab', () => ({
  SchemasTab: ({ highlight }: { highlight?: string }) => (
    <div data-testid="schemas-tab">schemas-tab:{highlight ?? 'none'}</div>
  ),
}));
vi.mock('./schemaInfoSheet/ModesTab', () => ({
  ModesTab: () => <div data-testid="modes-tab">modes-tab</div>,
}));
vi.mock('./YSQTestSheet', () => ({
  YSQTestSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="ysq-test-sheet">
      <button onClick={onClose}>close-ysq</button>
    </div>
  ),
  YSQ_RESULT_KEY: 'ysq_result_v1',
  YSQ_PROGRESS_KEY: 'ysq_progress_v1',
}));
// SchemaInfoSheet сам ре-экспортирует эти ключи из ./YSQTestSheet (мок выше) —
// берём их оттуда же, а не из реального хука, иначе тест пишет прогресс не по
// тому ключу, который читает замоканный компонент.
import { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from './YSQTestSheet';

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

describe('SchemaInfoContent — вкладки', () => {
  it('по умолчанию открыта вкладка «Потребности»', () => {
    render(<SchemaInfoContent />);
    expect(screen.getByTestId('needs-tab')).toBeTruthy();
    expect(screen.queryByTestId('schemas-tab')).toBeNull();
  });

  it('клик по «Схемы» переключает на SchemasTab', () => {
    render(<SchemaInfoContent />);
    fireEvent.click(screen.getByText('Схемы'));
    expect(screen.getByTestId('schemas-tab')).toBeTruthy();
    expect(screen.queryByTestId('needs-tab')).toBeNull();
  });

  it('клик по «Режимы» переключает на ModesTab', () => {
    render(<SchemaInfoContent />);
    fireEvent.click(screen.getByText('Режимы'));
    expect(screen.getByTestId('modes-tab')).toBeTruthy();
  });

  it('initialTab и highlight пробрасываются в стартовую вкладку', () => {
    render(<SchemaInfoContent initialTab="schemas" highlight="Покинутость" />);
    expect(screen.getByText('schemas-tab:Покинутость')).toBeTruthy();
  });
});

describe('SchemaInfoSheet — баннер незаконченного теста (из реального localStorage)', () => {
  it('нет прогресса и результата — баннер не показывается, CTA «Пройти тест на схемы»', () => {
    render(<SchemaInfoSheet onClose={() => {}} />);
    expect(screen.queryByText('Незаконченный тест')).toBeNull();
    expect(screen.getByText('Пройти тест на схемы')).toBeTruthy();
    expect(screen.getByText('116 вопросов · ~10 минут')).toBeTruthy();
  });

  it('есть прогресс, нет результата — показывает баннер и CTA «Продолжить тест»', () => {
    localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ page: 2 }));
    render(<SchemaInfoSheet onClose={() => {}} />);
    expect(screen.getByText('Незаконченный тест')).toBeTruthy();
    expect(screen.getByText('Продолжить тест')).toBeTruthy();
  });

  it('есть результат — CTA «Мои результаты теста», баннер прогресса не показывается', () => {
    localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ page: 2 }));
    localStorage.setItem(YSQ_RESULT_KEY, JSON.stringify({ schemas: [] }));
    render(<SchemaInfoSheet onClose={() => {}} />);
    expect(screen.queryByText('Незаконченный тест')).toBeNull();
    expect(screen.getByText('Мои результаты теста')).toBeTruthy();
    expect(screen.getByText('Посмотреть или пройти заново')).toBeTruthy();
  });
});

describe('SchemaInfoSheet — открытие теста', () => {
  it('клик по CTA теста открывает YSQTestSheet', () => {
    render(<SchemaInfoSheet onClose={() => {}} />);
    fireEvent.click(screen.getByText('Пройти тест на схемы'));
    expect(screen.getByTestId('ysq-test-sheet')).toBeTruthy();
  });

  it('клик по баннеру незаконченного теста тоже открывает YSQTestSheet', () => {
    localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ page: 1 }));
    render(<SchemaInfoSheet onClose={() => {}} />);
    fireEvent.click(screen.getByText('Незаконченный тест'));
    expect(screen.getByTestId('ysq-test-sheet')).toBeTruthy();
  });

  it('закрытие YSQTestSheet возвращает к основному листу', () => {
    render(<SchemaInfoSheet onClose={() => {}} />);
    fireEvent.click(screen.getByText('Пройти тест на схемы'));
    fireEvent.click(screen.getByText('close-ysq'));
    expect(screen.queryByTestId('ysq-test-sheet')).toBeNull();
    expect(screen.getByText('Пройти тест на схемы')).toBeTruthy();
  });
});
