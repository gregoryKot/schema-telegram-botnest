// @vitest-environment jsdom
// Кабинет терапевта в оболочке (b29):
//  • «Сегодня» и «Справочник» лежат в обёртке .page — своя прокрутка: на ≥768 .canvas режет
//    переполнение (overflow: hidden), и без неё низ экрана был недостижим (на 1280×900 «Сегодня»
//    прятал 123px — третью строку «Требуют внимания», «Справочник» — 581px);
//  • лупа списка клиентов открывает палитру оболочки (ov.setCmdOpen(true)).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';
import { useRef } from 'react';
import { AppSections } from './AppSections';

vi.mock('../TherapistClientSheet', () => ({
  TherapistClientSheet: (p: { onOpenPalette?: () => void }) => <button onClick={p.onOpenPalette}>лупа</button>,
}));
vi.mock('../../sections/TherapistTodaySection', () => ({ TherapistTodaySection: () => <h1>Сегодня</h1> }));
vi.mock('../../sections/TherapistGuideSection', () => ({ TherapistGuideSection: () => <h1>Справочник</h1> }));

function Host({ ov }: { ov: object }) {
  const nav = useNavigate();
  const loc = useLocation();
  const back = useRef(() => {});
  return (
    <AppSections
      inert={false} therapistMode pathname={loc.pathname} section="today" needs={[]} ratings={{}} displayName={null}
      navigate={nav} openClientRef={null} clients={[]} switchTherapistMode={() => {}} therapistBackHandlerRef={back}
      setTherapistClients={() => {}} setSection={() => {}} ov={ov as never} todayRefreshKey={0} userRole="THERAPIST"
      profileRefreshKey={0} childhoodRatings={{}} helpTasksKey={0} setHelpTasksKey={() => {}}
    />
  );
}
const mount = (path: string, ov: object = {}) =>
  render(<MemoryRouter initialEntries={[path]}><Host ov={ov} /></MemoryRouter>);

describe('AppSections: кабинет терапевта', () => {
  it.each([['/cabinet/today', 'Сегодня'], ['/cabinet/guide', 'Справочник']])('%s — в прокручиваемой обёртке .page', async (path, title) => {
    mount(path);
    const h = await screen.findByRole('heading', { name: title });
    expect(h.parentElement?.classList.contains('page')).toBe(true);
  });

  it('лупа списка клиентов открывает палитру оболочки', async () => {
    const setCmdOpen = vi.fn();
    mount('/cabinet', { setCmdOpen });
    const loupe = await screen.findByText('лупа');
    act(() => { loupe.click(); });
    expect(setCmdOpen).toHaveBeenCalledWith(true);
  });
});
