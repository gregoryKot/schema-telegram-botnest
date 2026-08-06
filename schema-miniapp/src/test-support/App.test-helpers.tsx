// Общий сетап для тестов App.tsx (0% покрытия — корень мини-аппа, 632 строки).
// Тот же приём, что и webapp/src/components/AppShell.test-helpers.tsx:
// тяжёлые дети (секции, оверлеи, кабинет терапевта, история трекера) —
// заглушки-кнопочницы, реальный код только тот, что решает сам App.tsx
// (роутинг по секции, начальная загрузка, состояние оверлеев). Типы пропов —
// через `ComponentProps` с type-only импортом реального компонента, чтобы
// подпись заглушки не могла разъехаться с прод-кодом без ошибки типов.
// Моки api/session/useUserFlags — в соседнем App.test-fixtures.ts (иначе файл
// пробивает потолок 300 строк, правило №10).
//
// ВАЖНО (как в webapp-хелпере): vi.mock — на верхнем уровне модуля, не внутри
// функции, иначе он не попадёт под hoisting и сработает позже статических
// импортов ниже.
import { vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { setHost, createWebHost } from '../../../shared/src/host';
import './App.test-fixtures';

import type { AppSections as AppSectionsT } from '../components/AppSections';
import type { AppOverlays as AppOverlaysT } from '../components/AppOverlays';
import type { TherapistClientSheet as TherapistClientSheetT } from '../components/TherapistClientSheet';
import type { TrackerHistoryOverlay as TrackerHistoryOverlayT } from '../components/TrackerHistoryOverlay';

export { mockUseUserFlags } from './App.test-fixtures';

vi.mock('../components/AppSections', () => ({
  AppSections: (p: ComponentProps<typeof AppSectionsT>) => (
    <div
      data-testid="app-sections"
      data-therapist-mode={String(p.therapistMode)}
      data-section={p.section}
      data-user-role={p.userRole}
      data-today-refresh-key={p.todayRefreshKey}
      data-profile-refresh-key={p.profileRefreshKey}
    >
      {/* Реальные секции сами открывают оверлеи через общий sheets-реестр
          (App.tsx передаёт им один и тот же объект `sheets`) — заглушка
          дёргает его напрямую вместо пяти отдельных onOpenX-колбэков. */}
      <button
        data-testid="app-sections-open-tracker"
        onClick={() => p.sheets.open('trackerOverlay', { trackerNeedId: null })}
      >
        open-tracker
      </button>
      <button
        data-testid="app-sections-open-tracker-history"
        onClick={() => p.sheets.open('tracker', { trackerTab: 'history' })}
      >
        open-tracker-history
      </button>
      <button
        data-testid="app-sections-open-settings"
        onClick={() => p.sheets.open('settings')}
      >
        open-settings
      </button>
      <button
        data-testid="app-sections-open-cabinet"
        onClick={() => {
          p.setCabinetView('list');
          p.switchTherapistMode(true);
        }}
      >
        open-cabinet
      </button>
      <button
        data-testid="app-sections-new-diary-entry"
        onClick={() => p.onNewDiaryEntry('schema')}
      >
        new-diary-entry
      </button>
    </div>
  ),
}));

vi.mock('../components/AppOverlays', () => ({
  AppOverlays: (p: ComponentProps<typeof AppOverlaysT>) => (
    <div
      data-testid="app-overlays"
      data-tracker-overlay={String(p.sheets.trackerOverlay)}
      data-tracker={String(p.sheets.tracker)}
      data-today-note={String(p.sheets.todayNote)}
      data-address-picker={String(p.sheets.addressPicker)}
      data-settings={String(p.sheets.settings)}
      data-celebration-streak={p.celebrationStreak ?? ''}
      data-childhood-pending={String(p.childhoodWheelPending)}
      data-show-onboarding={String(p.showOnboarding)}
      data-consent-given={String(p.consentGiven)}
      data-therapist-mode={String(p.therapistMode)}
      data-display-name={p.displayName ?? ''}
      data-section={p.section}
      data-new-diary-entry={p.newDiaryEntry ?? ''}
      data-is-offline={String(p.isOffline)}
      data-rating-attachment={p.ratings.attachment ?? ''}
      data-saved-attachment={String(p.saved.attachment ?? '')}
    >
      <button
        data-testid="app-overlays-save-with-streak"
        onClick={() =>
          p.onSaved('attachment', {
            currentStreak: 3,
            longestStreak: 3,
            totalDays: 6,
            todayDone: true,
            weekDots: [],
          })
        }
      >
        save-with-streak
      </button>
      <button
        data-testid="app-overlays-save-with-big-streak"
        onClick={() =>
          p.onSaved('attachment', {
            currentStreak: 4,
            longestStreak: 4,
            totalDays: 5,
            todayDone: true,
            weekDots: [],
          })
        }
      >
        save-with-big-streak
      </button>
      <button
        data-testid="app-overlays-save-no-streak"
        onClick={() =>
          p.onSaved('attachment', {
            currentStreak: 0,
            longestStreak: 2,
            totalDays: 1,
            todayDone: true,
            weekDots: [],
          })
        }
      >
        save-no-streak
      </button>
      <button
        data-testid="app-overlays-change"
        onClick={() => p.onChange('attachment', 7)}
      >
        change
      </button>
      <button
        data-testid="app-overlays-address-picker-done"
        onClick={() => p.onAddressPickerDone()}
      >
        address-picker-done
      </button>
      <button
        data-testid="app-overlays-accept-disclaimer"
        onClick={() => p.onAcceptDisclaimer()}
      >
        accept-disclaimer
      </button>
      <button
        data-testid="app-overlays-toggle-therapist"
        onClick={() => p.switchTherapistMode(!p.therapistMode)}
      >
        toggle-therapist
      </button>
      <button
        data-testid="app-overlays-resign-therapist"
        onClick={() => {
          void p.onResignTherapist();
        }}
      >
        resign-therapist
      </button>
      <button
        data-testid="app-overlays-close-tracker-overlay"
        onClick={() =>
          p.sheets.close('trackerOverlay', { trackerNeedId: null })
        }
      >
        close-tracker-overlay
      </button>
      <button
        data-testid="app-overlays-close-settings"
        onClick={() => p.sheets.close('settings')}
      >
        close-settings
      </button>
      <button
        data-testid="app-overlays-set-section-profile"
        onClick={() => p.setSection('profile')}
      >
        set-section-profile
      </button>
    </div>
  ),
}));

vi.mock('../components/TherapistClientSheet', () => ({
  TherapistClientSheet: (p: ComponentProps<typeof TherapistClientSheetT>) => (
    <div data-testid="therapist-client-sheet" data-view={p.view}>
      <button data-testid="therapist-client-sheet-close" onClick={p.onClose}>
        close
      </button>
      <button
        data-testid="therapist-client-sheet-view-client"
        onClick={() => p.onViewChange('client')}
      >
        view-client
      </button>
    </div>
  ),
}));

vi.mock('../components/TrackerHistoryOverlay', () => ({
  TrackerHistoryOverlay: (p: ComponentProps<typeof TrackerHistoryOverlayT>) => (
    <div
      data-testid="tracker-history-overlay"
      data-tracker={String(p.sheets.tracker)}
      data-history-loading={String(p.historyLoading)}
      data-history-count={p.history.length}
    />
  ),
}));

// App.tsx импортируется ПОСЛЕ vi.mock-ов выше (те hoisting-ятся над этим
// импортом автоматически, но статический импорт всё равно обязан идти
// синтаксически после — иначе перехват модулей не сработает, см. комментарий
// в шапке файла и в webapp-хелпере).
import App from '../App';

/** Рендерит App с чистым web-хостом (id 'web' → shouldShowLoginScreen()===true,
 *  useSafeTop/insets детерминированы, backButton — история браузера). */
export function renderApp() {
  setHost(createWebHost());
  return render(<App />);
}

/** Меняет query-string/путь ДО рендера — App.tsx читает его один раз в
 *  useState(getInitialSection). */
export function setUrl(search: string): void {
  window.history.pushState({}, '', search);
}
