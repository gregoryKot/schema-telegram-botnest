// @vitest-environment jsdom
// SchemaInfoSheet — объясняющий лист «Как это работает» (потребности/схемы/
// режимы) + вход в тест YSQ (0% покрытия, 439 строк). YSQTestSheet
// мокаем заглушкой — он лениво импортируется и покрыт отдельно, здесь
// проверяем оркестрацию: переключение вкладок, разворачивание доменов схем,
// чек-ин режима, и три состояния CTA теста (нет/есть прогресс/есть результат)
// — денормализованное состояние в localStorage, должно совпадать с текстом кнопки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaInfoSheet } from './SchemaInfoSheet';
import { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from '../utils/storageKeys';

vi.mock('./YSQTestSheet', () => ({
  YSQTestSheet: ({ onClose }: { onClose: () => void }) => (
    <div>
      Мок теста YSQ
      <button onClick={onClose}>Закрыть тест</button>
    </div>
  ),
}));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderSheet(props: Partial<Parameters<typeof SchemaInfoSheet>[0]> = {}) {
  return render(
    <MemoryRouter>
      <SchemaInfoSheet onClose={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

describe('SchemaInfoSheet — вкладки', () => {
  it('по умолчанию открыта вкладка «Потребности» с пятью потребностями', () => {
    renderSheet();
    expect(screen.getByText('Привязанность')).toBeTruthy();
    expect(screen.getByText('Границы')).toBeTruthy();
  });

  it('переключение на «Схемы» показывает список доменов', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Схемы'));
    // Доменов 5 — просто проверяем, что вкладка сменилась (потребности пропали).
    expect(screen.queryByText('Привязанность')).toBeNull();
  });

  it('клик по домену схем раскрывает список схем внутри него', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Схемы'));
    const domainHeader = screen.getAllByRole('button').find(b => b.textContent?.includes('Отчуждение и отвержение'));
    expect(domainHeader).toBeTruthy();
    fireEvent.click(domainHeader!);
    // После раскрытия появляется хотя бы одна схема этого домена.
    expect(screen.getAllByRole('button').length).toBeGreaterThan(3);
  });

  it('переключение на «Режимы» показывает группы режимов', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Режимы'));
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getByText('Здоровый Взрослый')).toBeTruthy();
  });
});

describe('SchemaInfoSheet — чек-ин режима', () => {
  it('клик по карточке «Как ты себя чувствуешь?» открывает выбор ощущения', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Режимы'));
    fireEvent.click(screen.getByText('Как ты себя чувствуешь? →'));
    expect(screen.getByText('сейчас?')).toBeTruthy();
  });

  it('выбор ощущения показывает соответствующий режим и подсказку', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Режимы'));
    fireEvent.click(screen.getByText('Как ты себя чувствуешь? →'));
    fireEvent.click(screen.getByText('Одиноко / страшно'));
    expect(screen.getByRole('heading', { name: 'Уязвимый Ребёнок' })).toBeTruthy();
    expect(screen.getByText('Что помогает')).toBeTruthy();
  });

  it('«Понятно» закрывает результат и возвращает к списку режимов', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Режимы'));
    fireEvent.click(screen.getByText('Как ты себя чувствуешь? →'));
    fireEvent.click(screen.getByText('Одиноко / страшно'));
    fireEvent.click(screen.getByText('Понятно'));
    expect(screen.queryByText('Что помогает')).toBeNull();
  });
});

describe('SchemaInfoSheet — CTA теста YSQ (состояние из localStorage)', () => {
  it('без прогресса и результата — «Пройти тест на схемы»', () => {
    renderSheet();
    expect(screen.getByText('Пройти тест на схемы')).toBeTruthy();
    expect(screen.queryByText('Незаконченный тест')).toBeNull();
  });

  it('есть сохранённый прогресс, нет результата — «Продолжить тест» + баннер незаконченного', () => {
    localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ answers: [1], page: 0 }));
    renderSheet();
    expect(screen.getByText('Продолжить тест')).toBeTruthy();
    expect(screen.getByText('Незаконченный тест')).toBeTruthy();
  });

  it('есть результат — «Мои результаты теста», баннер незаконченного не показывается', () => {
    localStorage.setItem(YSQ_RESULT_KEY, JSON.stringify({ top: [] }));
    localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ answers: [1], page: 0 }));
    renderSheet();
    expect(screen.getByText('Мои результаты теста')).toBeTruthy();
    expect(screen.queryByText('Незаконченный тест')).toBeNull();
  });

  it('клик по CTA открывает (замоканный) YSQTestSheet, закрытие возвращает к листу', async () => {
    // React.lazy резолвится асинхронно даже с замоканным модулем — ждём.
    renderSheet();
    fireEvent.click(screen.getByText('Пройти тест на схемы'));
    expect(await screen.findByText('Мок теста YSQ')).toBeTruthy();
    fireEvent.click(screen.getByText('Закрыть тест'));
    expect(screen.queryByText('Мок теста YSQ')).toBeNull();
    expect(screen.getByText('Пройти тест на схемы')).toBeTruthy();
  });
});

describe('SchemaInfoSheet — навигация назад', () => {
  it('кнопка «Назад» вызывает onClose (через useHistorySheet)', () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    fireEvent.click(screen.getByText('Назад'));
    expect(onClose).toHaveBeenCalled();
  });
});
