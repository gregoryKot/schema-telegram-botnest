// @vitest-environment jsdom
// Справочник схем из «Профиля» и «Практики» открывается одним входом —
// ov.openSchema (useOverlays.ts), как «+», палитра и колесо детства. Прежние
// лямбды ставили тест и вкладку, но не сбрасывали подсветку: схема,
// подсвеченная прошлым входом, оставалась подсвеченной и в следующем.
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AppSections } from './AppSections';
import { useOverlays } from './useOverlays';
import type { Section } from './navigation';

type OpenOpts = { startTest?: boolean; tab?: 'needs' | 'schemas' | 'modes' };
vi.mock('../../sections/ProfileSection', () => ({
  ProfileSection: (p: { onTakeTest: () => void }) => <button onClick={p.onTakeTest}>пройти тест</button>,
}));
vi.mock('../../sections/PracticeSection', () => ({
  PracticeSection: (p: { onOpenSchema: (o?: OpenOpts) => void }) => (
    <button onClick={() => p.onOpenSchema({ tab: 'schemas' })}>мои схемы</button>
  ),
}));

const snap = { ov: null as ReturnType<typeof useOverlays> | null };

function Host({ section }: { section: Section }) {
  const ov = useOverlays();
  const navigate = useNavigate();
  useEffect(() => { snap.ov = ov; });
  return (
    <AppSections
      inert={false} therapistMode={false} pathname="/" section={section} needs={[]} ratings={{}} displayName={null}
      navigate={navigate} openClientRef={null} clients={[]} switchTherapistMode={() => {}}
      therapistBackHandlerRef={{ current: () => {} }} setTherapistClients={() => {}} setSection={() => {}}
      ov={ov} todayRefreshKey={0} userRole="CLIENT" profileRefreshKey={0} childhoodRatings={{}}
      helpTasksKey={0} setHelpTasksKey={() => {}}
    />
  );
}

async function openFrom(section: Section, button: string) {
  render(<MemoryRouter><Host section={section} /></MemoryRouter>);
  // Подсветка от прошлого входа (например, «Мои схемы» колеса детства).
  act(() => snap.ov!.openSchema({ highlight: 'abandonment' }));
  act(() => snap.ov!.setShowSchemaInfo(false));
  const btn = await screen.findByText(button);
  act(() => btn.click());
  return snap.ov!;
}

describe('AppSections: справочник схем — один вход ov.openSchema', () => {
  it('«Профиль» → тест: справочник с тестом на вкладке потребностей, без старой подсветки', async () => {
    const ov = await openFrom('profile', 'пройти тест');
    expect(ov.showSchemaInfo).toBe(true);
    expect(ov.schemaAutoStartTest).toBe(true);
    expect(ov.schemaInitialTab).toBe('needs');
    expect(ov.schemaHighlight).toBeUndefined();
  });

  it('«Практика» → вкладка схем без теста и без старой подсветки', async () => {
    const ov = await openFrom('practice', 'мои схемы');
    expect(ov.showSchemaInfo).toBe(true);
    expect(ov.schemaAutoStartTest).toBe(false);
    expect(ov.schemaInitialTab).toBe('schemas');
    expect(ov.schemaHighlight).toBeUndefined();
  });
});
