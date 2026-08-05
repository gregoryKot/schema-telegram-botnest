// Общий сетап для тестов AppShell.tsx. Реальные секции/оверлеи слишком тяжелы
// (свои API-вызовы, xyflow, canvas) и уже покрыты собственными тестами —
// здесь мокаем каждую (в т.ч. лениво загруженную) заглушкой-кнопочницей: тест
// видит именно логику самого AppShell (роутинг, data-fetch эффекты, состояние
// оверлеев/селебрейшена), а не чужую. Типы пропов берём через `ComponentProps`
// с type-only импортом реального компонента — так подпись не расходится с
// продакшен-кодом, а сам импорт не тянет модуль в рантайме (не ломает vi.mock).
import { vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './AppShell';

import type { TodaySection as TodaySectionT } from '../sections/TodaySection';
import type { SchemasSection as SchemasSectionT } from '../sections/SchemasSection';
import type { ProfileSection as ProfileSectionT } from '../sections/ProfileSection';
import type { PracticeSection as PracticeSectionT } from '../sections/PracticeSection';
import type { TherapistTodaySection as TherapistTodaySectionT } from '../sections/TherapistTodaySection';
import type { TrackerOverlay as TrackerOverlayT } from './TrackerOverlay';
import type { HistorySheet as HistorySheetT } from './HistorySheet';
import type { SettingsSheet as SettingsSheetT } from './SettingsSheet';
import type { PracticesScreen as PracticesScreenT } from './PracticesScreen';
import type { PlansScreen as PlansScreenT } from './PlansScreen';
import type { SchemaInfoSheet as SchemaInfoSheetT } from './SchemaInfoSheet';
import type { TherapistClientSheet as TherapistClientSheetT } from './TherapistClientSheet';
import type { TherapistPrivacyDisclaimer as TherapistPrivacyDisclaimerT } from './TherapistPrivacyDisclaimer';
import type { NoteSheet as NoteSheetT } from './NoteSheet';
import type { Celebration as CelebrationT } from './Celebration';
import type { TaskCreateSheet as TaskCreateSheetT } from './TaskCreateSheet';
import type { CommandPalette as CommandPaletteT } from './CommandPalette';
import type { ChildhoodWheelEx as ChildhoodWheelExT } from './exercises/ChildhoodWheelEx';

/** Заглушка любого мокнутого экрана: рендерит по кнопке на каждый колбэк из `map`. */
function Btns({ testid, map }: { testid: string; map: Record<string, () => void> }) {
  return (
    <div data-testid={testid}>
      {Object.entries(map).map(([k, fn]) => (
        <button key={k} data-testid={`${testid}-${k}`} onClick={fn}>{k}</button>
      ))}
    </div>
  );
}

vi.mock('../auth/authContext', () => ({ useAuth: () => ({ logout: mockLogout }) }));
export const mockLogout = vi.fn();

vi.mock('../sections/TodaySection', () => ({
  TodaySection: (p: ComponentProps<typeof TodaySectionT>) => (
    <Btns testid="today-section" map={{
      navigate: () => p.onNavigate('diary'),
      tracker: () => p.onOpenTracker(),
      trackerAt: () => p.onOpenTrackerAt?.('attachment'),
      schema: () => p.onOpenSchema({ startTest: true, tab: 'schemas', highlight: 'abandonment' }),
      history: () => p.onOpenTrackerHistory?.(),
      diaries: () => p.onOpenDiaries(),
      childhood: () => p.onOpenChildhoodWheel(),
      cabinet: () => p.onOpenTherapistCabinet?.(),
      advanced: () => p.onOpenAdvanced(),
    }} />
  ),
}));
vi.mock('../sections/DiarySection', () => ({ DiarySection: () => <div data-testid="diary-section" /> }));
vi.mock('../sections/SchemasSection', () => ({
  SchemasSection: (p: ComponentProps<typeof SchemasSectionT>) => (
    <Btns testid="schemas-section" map={{
      schema: () => p.onOpenSchema({ tab: 'modes' }),
      childhood: () => p.onOpenChildhoodWheel?.(),
    }} />
  ),
}));
vi.mock('../sections/ProfileSection', () => ({
  ProfileSection: (p: ComponentProps<typeof ProfileSectionT>) => (
    <Btns testid="profile-section" map={{
      settings: () => p.onOpenSettings?.(),
      tracker: () => p.onOpenTracker?.(),
    }} />
  ),
}));
vi.mock('../sections/PracticeSection', () => ({
  PracticeSection: (p: ComponentProps<typeof PracticeSectionT>) => (
    <Btns testid="practice-section" map={{
      childhood: () => p.onOpenChildhoodWheel(),
      practices: () => p.onOpenPractices(),
      plans: () => p.onOpenPlans(),
      tracker: () => p.onOpenTracker(),
      diaries: () => p.onOpenDiaries(),
      tasksChanged: () => p.onTasksChanged?.(),
    }} />
  ),
}));
vi.mock('../sections/TherapistTodaySection', () => ({
  TherapistTodaySection: (p: ComponentProps<typeof TherapistTodaySectionT>) => (
    <Btns testid="therapist-today-section" map={{ openClient: () => p.onOpenClient(7) }} />
  ),
}));

vi.mock('./TrackerOverlay', () => ({
  TrackerOverlay: (p: ComponentProps<typeof TrackerOverlayT>) => (
    <Btns testid="tracker-overlay" map={{
      close: () => p.onClose(),
      saveWithStreak: () => p.onSaved('attachment', { currentStreak: 3, longestStreak: 3, totalDays: 6, todayDone: true, weekDots: [] }),
      saveNoStreak: () => p.onSaved('attachment', { currentStreak: 0, longestStreak: 2, totalDays: 1, todayDone: true, weekDots: [] }),
      note: () => p.onOpenNote?.(),
      goal: () => p.onOpenGoal?.(),
      openHistory: () => p.onOpenHistory?.(),
    }} />
  ),
}));
vi.mock('./HistorySheet', () => ({
  HistorySheet: (p: ComponentProps<typeof HistorySheetT>) => (
    <Btns testid="history-sheet" map={{
      close: () => p.onClose(),
      tracker: () => p.onOpenTracker(),
      schemas: () => p.onOpenSchemas(),
      childhood: () => p.onOpenChildhoodWheel(),
      dismissPlan: () => p.onDismissPlan(1),
      refreshed: () => p.onHistoryRefreshed([{ date: '2026-01-01', ratings: {} }]),
    }} />
  ),
}));
vi.mock('./DiariesOverlay', () => ({ DiariesOverlay: (p: { onClose: () => void }) => (
  <Btns testid="diaries-overlay" map={{ close: () => p.onClose() }} />
) }));
vi.mock('./SettingsSheet', () => ({
  SettingsSheet: (p: ComponentProps<typeof SettingsSheetT>) => (
    <Btns testid="settings-sheet" map={{
      close: () => p.onClose(),
      cabinet: () => p.onOpenTherapistCabinet?.(),
      toggleTherapist: () => p.onToggleTherapistMode?.(),
      resign: () => { void p.onResignTherapist?.(); },
    }} />
  ),
}));
vi.mock('./PracticesScreen', () => ({
  PracticesScreen: (p: ComponentProps<typeof PracticesScreenT>) => (
    <Btns testid="practices-screen" map={{ close: () => p.onClose(), tracker: () => p.onOpenTracker?.() }} />
  ),
}));
vi.mock('./PlansScreen', () => ({
  PlansScreen: (p: ComponentProps<typeof PlansScreenT>) => (
    <Btns testid="plans-screen" map={{ close: () => p.onClose(), tracker: () => p.onOpenTracker?.() }} />
  ),
}));
vi.mock('./SchemaInfoSheet', () => ({
  SchemaInfoSheet: (p: ComponentProps<typeof SchemaInfoSheetT>) => (
    <Btns testid="schema-info-sheet" map={{ close: () => p.onClose() }} />
  ),
}));
vi.mock('./exercises/ChildhoodWheelEx', () => ({
  ChildhoodWheelEx: (p: ComponentProps<typeof ChildhoodWheelExT>) => (
    <Btns testid="childhood-wheel" map={{ back: () => p.onBack(), saved: () => p.onSaved({ safety: 5 }) }} />
  ),
}));
vi.mock('./TherapistClientSheet', () => ({
  TherapistClientSheet: (p: ComponentProps<typeof TherapistClientSheetT>) => (
    <Btns testid="therapist-client-sheet" map={{
      close: () => p.onClose(),
      toList: () => p.onViewChange('list'),
      openClient: () => p.onOpenClient?.(42),
      clients: () => p.onClientsChange?.([{ telegramId: 1, name: 'А', clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [] }]),
    }} />
  ),
}));
vi.mock('./TherapistPrivacyDisclaimer', () => ({
  TherapistPrivacyDisclaimer: (p: ComponentProps<typeof TherapistPrivacyDisclaimerT>) => (
    <Btns testid="therapist-disclaimer" map={{ done: () => p.onDone() }} />
  ),
}));
vi.mock('./NoteSheet', () => ({
  NoteSheet: (p: ComponentProps<typeof NoteSheetT>) => (
    <Btns testid="note-sheet" map={{ close: () => p.onClose() }} />
  ),
}));
vi.mock('./Celebration', () => ({
  Celebration: (p: ComponentProps<typeof CelebrationT>) => (
    <Btns testid={`celebration-streak-${p.streak}`} map={{ done: () => p.onDone() }} />
  ),
}));
vi.mock('./TaskCreateSheet', () => ({
  TaskCreateSheet: (p: ComponentProps<typeof TaskCreateSheetT>) => (
    <Btns testid="task-create-sheet" map={{ close: () => p.onClose(), created: () => p.onCreated() }} />
  ),
}));
vi.mock('./CommandPalette', () => ({
  CommandPalette: (p: ComponentProps<typeof CommandPaletteT>) => (
    <Btns testid="command-palette" map={{
      close: () => p.onClose(),
      navigateDiary: () => p.onNavigate('diary'),
      toggleMode: () => p.onToggleMode?.(),
      openClient: () => p.onOpenClient?.(9),
      newDiaryEntry: () => p.onNewDiaryEntry?.(),
    }} />
  ),
}));
vi.mock('./DonateNudge', () => ({ DonateNudge: () => null }));

// Дефолтные резолвы api — покрывают ВСЕ вызовы из начального эффекта AppShell,
// чтобы неотмоканный тест не падал на `.then` от undefined. Переопределяется
// через `mockResolvedValueOnce` в конкретных тестах. ВАЖНО: вызов vi.mock
// обязан быть на верхнем уровне модуля (не в функции) — иначе не попадёт под
// hoisting и сработает уже ПОСЛЕ того, как статический `import { AppShell }`
// выше в этом файле успеет подтянуть настоящий '../api' (баг, пойманный при
// разработке этого хелпера: обёртка в функцию регистрировала мок слишком поздно).
vi.mock('../api', () => ({
  api: {
    init: vi.fn().mockResolvedValue(undefined),
    recordActivity: vi.fn().mockResolvedValue(undefined),
    getDisclaimer: vi.fn().mockResolvedValue({ accepted: true }),
    acceptDisclaimer: vi.fn().mockResolvedValue(undefined),
    getPractices: vi.fn().mockResolvedValue([]),
    getPlanHistory: vi.fn().mockResolvedValue([]),
    needs: vi.fn().mockResolvedValue([]),
    ratings: vi.fn().mockResolvedValue({}),
    getPendingPlans: vi.fn().mockResolvedValue([]),
    getChildhoodRatings: vi.fn().mockResolvedValue({}),
    getYsqProgress: vi.fn().mockResolvedValue(null),
    getYsqResult: vi.fn().mockResolvedValue(null),
    getProfile: vi.fn().mockResolvedValue({ role: 'CLIENT', name: null, mySchemaIds: [] }),
    getTherapyClients: vi.fn().mockResolvedValue([]),
    getTherapyRelation: vi.fn().mockResolvedValue(null),
    getTasks: vi.fn().mockResolvedValue([]),
    setTherapistView: vi.fn().mockResolvedValue({ ok: true }),
    resignTherapist: vi.fn().mockResolvedValue(undefined),
    history: vi.fn().mockResolvedValue([]),
    trackEvent: vi.fn(),
  },
}));

/** Рендерит AppShell в маршрутах, повторяющих реальную схему из App.tsx —
 *  useParams(':clientId') читает параметр, только когда путь реально совпал
 *  с описанным Route (иначе всегда {}), поэтому '/cabinet/:clientId' обязателен. */
export function renderAppShell(initialPath = '/today') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/today" element={<AppShell />} />
        <Route path="/diary" element={<AppShell />} />
        <Route path="/schemas" element={<AppShell />} />
        <Route path="/profile" element={<AppShell />} />
        <Route path="/practice" element={<AppShell />} />
        <Route path="/cabinet" element={<AppShell />} />
        <Route path="/cabinet/:clientId" element={<AppShell />} />
        <Route path="*" element={<AppShell />} />
      </Routes>
    </MemoryRouter>,
  );
}
