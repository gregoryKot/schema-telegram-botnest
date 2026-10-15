// @vitest-environment jsdom
// AppOverlays отдаёт разбору случая и карте себя функции из реестра закрытия
// (hooks/overlayClosers): крестик этих листов и «Назад» хоста — одна и та же
// функция. Раньше оба компонента закрывались своим sheets.close(...), и
// правка реестра до них не доезжала (ревью PR #696). Это шов AppOverlays →
// компонент: заглушка кладёт свой onClose на кнопку, тап обязан дойти ровно
// до closers[ключ]. Потребление onClose самими компонентами — в
// CaseFlowOverlay.test / SelfMapOverlay.test.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AppOverlays } from './AppOverlays';
import { OVERLAY_SHEET_KEYS } from '../hooks/anyOverlayOpen';
import type { OverlaySheetKey } from '../hooks/sheetsStack';
import { initialState, type UseSheetsReturn } from '../hooks/useSheets';

vi.mock('./caseFlow/CaseFlowOverlay', () => ({
  CaseFlowOverlay: (p: { onClose: () => void }) => (
    <button onClick={p.onClose}>case-flow-close</button>
  ),
}));
vi.mock('./selfMap/SelfMapOverlay', () => ({
  SelfMapOverlay: (p: { onClose: () => void }) => (
    <button onClick={p.onClose}>self-map-close</button>
  ),
}));
vi.mock('./DonateNudge', () => ({ DonateNudge: () => null }));
vi.mock('../api', () => ({ api: { getPair: vi.fn().mockResolvedValue({}) } }));

afterEach(cleanup);

function mount(open: OverlaySheetKey) {
  const sheets: UseSheetsReturn = {
    ...initialState,
    [open]: true,
    openOrder: [open],
    open: vi.fn(),
    close: vi.fn(),
  };
  const closers = Object.fromEntries(
    OVERLAY_SHEET_KEYS.map((k) => [k, vi.fn()]),
  ) as Record<OverlaySheetKey, ReturnType<typeof vi.fn>>;
  render(
    <AppOverlays
      sheets={sheets}
      closers={closers}
      needs={[]}
      ratings={{}}
      saved={{}}
      isOffline={false}
      onChange={vi.fn()}
      onSaved={vi.fn()}
      yesterdayRatings={{}}
      showOnboarding={false}
      consentGiven={false}
      onConsentDisclaimer={vi.fn()}
      onAcceptDisclaimer={vi.fn()}
      celebrationStreak={null}
      setCelebrationStreak={vi.fn()}
      setChildhoodRatings={vi.fn()}
      setPairData={vi.fn()}
      userRole="CLIENT"
      displayName={null}
      setDisplayName={vi.fn()}
      therapistMode={false}
      switchTherapistMode={vi.fn()}
      onResignTherapist={vi.fn()}
      diaryActiveSchemaIds={undefined}
      newDiaryEntry={null}
      setNewDiaryEntry={vi.fn()}
      section="today"
      setSection={vi.fn()}
    />,
  );
  return { sheets, closers };
}

describe('AppOverlays — разбор случая и карта себя закрываются через реестр', () => {
  it.each([
    ['caseFlow', 'case-flow-close'],
    ['selfMap', 'self-map-close'],
  ] as const)('%s: тап по крестику зовёт closers[%s]', (key, label) => {
    const { sheets, closers } = mount(key);
    fireEvent.click(screen.getByText(label));
    expect(closers[key]).toHaveBeenCalledTimes(1);
    expect(sheets.close).not.toHaveBeenCalled();
    for (const other of OVERLAY_SHEET_KEYS.filter((k) => k !== key)) {
      expect(closers[other]).not.toHaveBeenCalled();
    }
  });
});
