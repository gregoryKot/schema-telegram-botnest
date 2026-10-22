// @vitest-environment jsdom
// Шов вложенности useHistorySheet на НАСТОЯЩИХ листах (находка аудита 2026-10,
// правило №14). Юнит-тесты хука с `vi.fn()` вместо onClose не ловят класс:
// `vi.fn()` лист не размонтирует, а в проде хост убирает лист по onClose — и
// нижний лист, закрывшийся сам в момент открытия верхнего, уносил верхний
// вместе с собой («Поделиться» в карточке схемы закрывало всю карточку).
// Здесь хост реально размонтирует нижний лист по его onClose.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { SchemaDetailSheet } from '../components/SchemaDetailSheet';
import { SchemaInfoSheet } from '../components/SchemaInfoSheet';

vi.mock('../api', () => ({
  api: {
    updateSettings: vi.fn().mockResolvedValue(undefined),
    getYsqHistory: vi.fn().mockResolvedValue([]),
    getYsqResult: vi.fn().mockResolvedValue(null),
    getYsqProgress: vi.fn().mockResolvedValue(null),
    saveYsqProgress: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
    trackPublicEvent: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// «Назад» браузера из независимого компонента (POP), как в useHistorySheet.test.
const nav: { back: () => void } = { back: () => {} };
function BackSpy() {
  const navigate = useNavigate();
  useEffect(() => { nav.back = () => navigate(-1); });
  return null;
}
const back = () => nav.back();

// Хост: показывает лист и убирает его по onClose — как AppOverlays.
function Host({ children }: { children: (onClose: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return open ? <>{children(() => setOpen(false))}</> : <div>HOST-CLOSED</div>;
}

describe('вложенность на настоящих листах: SchemaDetailSheet → ShareCardSheet', () => {
  it('«Поделиться» открывает карточку, а сама карточка схемы остаётся', () => {
    render(
      <MemoryRouter initialEntries={['/schemas']}>
        <BackSpy />
        <Host>{(onClose) => <SchemaDetailSheet schemaId="emotional_deprivation" onClose={onClose} />}</Host>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByText('Поделиться')[0]);

    expect(screen.getByText('Карточка схемы')).toBeTruthy();
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();
    expect(screen.getByText('Эмоциональная депривация')).toBeTruthy();
  });

  it('«Назад» закрывает сначала карточку для шаринга, затем сам лист', () => {
    render(
      <MemoryRouter initialEntries={['/schemas']}>
        <BackSpy />
        <Host>{(onClose) => <SchemaDetailSheet schemaId="emotional_deprivation" onClose={onClose} />}</Host>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByText('Поделиться')[0]);

    act(() => back());
    expect(screen.queryByText('Карточка схемы')).toBeNull();
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();
    expect(screen.getByText('Эмоциональная депривация')).toBeTruthy();

    act(() => back());
    expect(screen.getByText('HOST-CLOSED')).toBeTruthy();
  });
});

describe('вложенность на настоящих листах: SchemaInfoSheet → YSQTestSheet', () => {
  it('«Пройти тест» открывает тест, справочник остаётся; «Назад» закрывает тест, затем справочник', async () => {
    render(
      <MemoryRouter initialEntries={['/schemas']}>
        <BackSpy />
        <Host>{(onClose) => <SchemaInfoSheet onClose={onClose} />}</Host>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Пройти тест на схемы'));
    await waitFor(() => expect(screen.getByText('Начать тест')).toBeTruthy(), { timeout: 8000 });
    // Тест подгружается лениво, его эффект (запись истории) срабатывает после
    // появления на экране — даём ему отработать.
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();

    act(() => back());
    await waitFor(() => expect(screen.queryByText('Начать тест')).toBeNull(), { timeout: 8000 });
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();
    expect(screen.getByText('Пройти тест на схемы')).toBeTruthy();

    act(() => back());
    expect(screen.getByText('HOST-CLOSED')).toBeTruthy();
  }, 20000); // ленивый импорт теста под нагрузкой параллельных сьютов
});
