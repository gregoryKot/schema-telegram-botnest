// @vitest-environment jsdom
// Инцидент 2026-10-18 (docs/INCIDENTS.md): вход в дневник благодарности из «плюса»
// открывал форму без сохранённых пунктов дня, а сервер заменяет пункты дня
// целиком — вторая запись за день стирала первую. В AppDiaryNav.test.tsx
// форма замокана, поэтому связку «вход из плюса → форма → api» здесь проверяем
// на НАСТОЯЩЕЙ форме (read-after-write: сохранили утром → открыли вечером).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { AppDiaryNav } from './AppDiaryNav';
import type { UseSheetsReturn } from '../hooks/useSheets';
import { TODAY_DATE } from '../utils/todayConstants';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    createGratitudeDiary: vi.fn().mockResolvedValue(undefined),
    getGratitudeDiary: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
vi.mock('./plusMenu/QuickActionOverlays', () => ({
  QuickActionOverlays: () => null,
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.getGratitudeDiary).mockResolvedValue([
    {
      id: 1,
      date: TODAY_DATE,
      items: ['Утренний кофе', 'Звонок маме'],
      createdAt: `${TODAY_DATE}T08:00:00.000Z`,
    },
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const sheets = {
  about: false,
  schemaInfo: false,
  schemaAutoStartTest: false,
  schemaInitialTab: 'needs',
  schemaHighlight: undefined,
  settings: false,
  practices: false,
  plans: false,
  todayNote: false,
  pairSheet: false,
  childhoodWheel: false,
  tracker: false,
  trackerTab: 'today',
  trackerOverlay: false,
  trackerNeedId: null,
  trackerGoal: false,
  diaries: false,
  addressPicker: false,
  open: vi.fn(),
  close: vi.fn(),
} as unknown as UseSheetsReturn;

function openFromPlus() {
  render(
    <AppDiaryNav
      sheets={sheets}
      therapistMode={false}
      newDiaryEntry="gratitude"
      setNewDiaryEntry={vi.fn()}
      diaryActiveSchemaIds={undefined}
      section="help"
      setSection={vi.fn()}
      userRole="CLIENT"
    />,
  );
}

describe('AppDiaryNav — вход в благодарность из «плюса»', () => {
  it('после открытия видны пункты, уже сохранённые за сегодня', async () => {
    openFromPlus();
    expect(await screen.findByDisplayValue('Утренний кофе')).toBeTruthy();
    expect(screen.getByDisplayValue('Звонок маме')).toBeTruthy();
  });

  it('новый пункт уходит на сервер вместе со старыми, а не вместо них', async () => {
    openFromPlus();
    await screen.findByDisplayValue('Утренний кофе');
    fireEvent.change(screen.getByLabelText('Благодарность 3'), {
      target: { value: 'Вечерняя прогулка' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    await waitFor(() =>
      expect(api.createGratitudeDiary).toHaveBeenCalledWith(
        TODAY_DATE,
        ['Утренний кофе', 'Звонок маме', 'Вечерняя прогулка'],
        // base: сервер сливает с этим днём и не теряет пункт с другой вкладки
        ['Утренний кофе', 'Звонок маме'],
      ),
    );
  });
});
