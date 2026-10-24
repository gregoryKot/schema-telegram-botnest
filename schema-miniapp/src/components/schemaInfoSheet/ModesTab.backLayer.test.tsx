// @vitest-environment jsdom
// Шов «Назад» хоста ↔ чек-ин внутри справочника схем (находка аудита 2026-10).
// Чек-ин живёт в состоянии ModesTab, вне useSheets и реестра closers, поэтому
// «Назад» хоста закрывал справочник целиком вместе с чек-ином. Здесь настоящие
// useSheets + useHostBackButton + SchemaInfoSheet, нажатие идёт через
// BackButton хоста (образец — useHostBackButton.registry.test.ts), а не через
// вызов функции закрытия напрямую.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { SchemaInfoSheet } from '../SchemaInfoSheet';
import { useHostBackButton } from '../../hooks/useHostBackButton';
import { useSheets } from '../../hooks/useSheets';

vi.mock('../../api', () => ({ api: { getPair: vi.fn() } }));

const backButton = {
  isVisible: false,
  show: vi.fn(),
  hide: vi.fn(),
  onClick: vi.fn(),
  offClick: vi.fn(),
};
const pressHostBack = () => {
  const call = backButton.onClick.mock.calls[0] as [() => void];
  act(() => call[0]());
};

function Host() {
  const sheets = useSheets();
  useHostBackButton({
    sheets,
    newDiaryEntry: null,
    setNewDiaryEntry: vi.fn(),
    therapistMode: false,
    cabinetView: 'list',
    therapistBackHandlerRef: { current: vi.fn() },
    setPairData: vi.fn(),
    childhoodWheelPending: false,
    setChildhoodWheelPending: vi.fn(),
    onAddressPickerDone: vi.fn(),
  });
  return (
    <>
      <button onClick={() => sheets.open('schemaInfo')}>open-info</button>
      {sheets.schemaInfo && (
        <SchemaInfoSheet onClose={() => sheets.close('schemaInfo')} />
      )}
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.Telegram = {
    WebApp: { platform: 'ios', BackButton: backButton },
  } as unknown as Window['Telegram'];
});
afterEach(cleanup);

function openCheckin() {
  render(<Host />);
  fireEvent.click(screen.getByText('open-info'));
  fireEvent.click(screen.getByText('Режимы'));
  fireEvent.click(screen.getByText('Режим прямо сейчас'));
}

describe('ModesTab — чек-ин и «Назад» хоста', () => {
  it('«Назад» хоста закрывает чек-ин, справочник остаётся; второе «Назад» закрывает справочник', () => {
    openCheckin();
    expect(screen.getByText('Как ты сейчас?')).toBeTruthy();

    pressHostBack();
    expect(screen.queryByText('Как ты сейчас?')).toBeNull();
    expect(screen.getByText('Режим прямо сейчас')).toBeTruthy();

    pressHostBack();
    expect(screen.queryByText('Режим прямо сейчас')).toBeNull();
  });

  it('на экране результата «Назад» хоста закрывает весь чек-ин', () => {
    openCheckin();
    fireEvent.click(screen.getByText('Одиноко / страшно'));
    expect(screen.getByText('Что помогает')).toBeTruthy();

    pressHostBack();

    expect(screen.queryByText('Что помогает')).toBeNull();
    expect(screen.queryByText('Как ты сейчас?')).toBeNull();
    expect(screen.getByText('Режим прямо сейчас')).toBeTruthy();
  });

  it('закрытие чек-ина крестиком/«Понятно» снимает слой: «Назад» хоста закрывает справочник', () => {
    openCheckin();
    fireEvent.click(screen.getByText('Одиноко / страшно'));
    fireEvent.click(screen.getByText('Понятно'));

    pressHostBack();

    expect(screen.queryByText('Режим прямо сейчас')).toBeNull();
  });
});
