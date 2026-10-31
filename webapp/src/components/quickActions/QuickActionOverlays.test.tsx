// @vitest-environment jsdom
// Оверлей быстрого действия: каждое действие «плюса» открывает свой экран,
// null — ничего. Тяжёлые экраны подменены заглушками: проверяем маршрутизацию
// и то, что нужное колбэк-подключение (закрытие) дошло.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickActionOverlays } from './QuickActionOverlays';
import { OVERLAY_QUICK_ACTIONS } from './quickActionRouting';

vi.mock('../../api', () => ({
  api: {
    getModeDiary: vi.fn().mockResolvedValue([{}, {}]),
    getProfile: vi.fn().mockResolvedValue({ ysq: { activeSchemaIds: ['a'] } }),
    createSchemaDiary: vi.fn(), createModeDiary: vi.fn(), createGratitudeDiary: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
vi.mock('../caseFlow/CaseFlowHost', () => ({
  CaseFlowHost: (p: { start: string; onClose: () => void }) => (
    <button onClick={p.onClose}>case-host-{p.start}</button>
  ),
}));
vi.mock('../practice/QuickPracticeSheet', () => ({
  QuickPracticeSheet: (p: { id: string; onClose: () => void }) => <button onClick={p.onClose}>practice-{p.id}</button>,
}));
vi.mock('../diary/SchemaEntrySheet', () => ({
  SchemaEntrySheet: (p: { activeSchemaIds?: string[]; onClose: () => void }) => (
    <button onClick={p.onClose}>schema-sheet-{p.activeSchemaIds?.join(',') ?? 'none'}</button>
  ),
}));
vi.mock('../diary/ModeEntrySheet', () => ({
  ModeEntrySheet: (p: { onClose: () => void }) => <button onClick={p.onClose}>mode-sheet</button>,
}));
vi.mock('../diary/GratitudeEntrySheet', () => ({
  GratitudeEntrySheet: (p: { date: string; onClose: () => void }) => <button onClick={p.onClose}>gratitude-{p.date.length}</button>,
}));

const base = { onClose: vi.fn(), onOpenTracker: vi.fn(), onOpenSchema: vi.fn() };

describe('QuickActionOverlays', () => {
  it('active=null — ничего не рисует', () => {
    const { container } = render(<QuickActionOverlays active={null} {...base} />);
    expect(container.innerHTML).toBe('');
  });

  it('«Что случилось» открывает поток сразу на шагах, не на карте', async () => {
    render(<QuickActionOverlays active="case" {...base} />);
    expect(await screen.findByText('case-host-flow')).toBeTruthy();
  });

  it('дневник схем получает активные схемы профиля', async () => {
    render(<QuickActionOverlays active="diary_schema" {...base} />);
    await waitFor(() => expect(screen.getByText('schema-sheet-a')).toBeTruthy());
  });

  it('профиль не загрузился — лист открывается без схем и сбой уходит в отчёт', async () => {
    (api.getProfile as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));
    render(<QuickActionOverlays active="diary_schema" {...base} />);
    expect(await screen.findByText('schema-sheet-none')).toBeTruthy();
    await waitFor(() => expect(reportClientError).toHaveBeenCalled());
  });

  it('режим и благодарность (с сегодняшней датой YYYY-MM-DD) открываются', async () => {
    const { unmount } = render(<QuickActionOverlays active="diary_mode" {...base} />);
    expect(await screen.findByText('mode-sheet')).toBeTruthy();
    unmount();
    render(<QuickActionOverlays active="diary_gratitude" {...base} />);
    expect(await screen.findByText('gratitude-10')).toBeTruthy();
  });

  it.each(['breathing', 'grounding', 'stop'] as const)('%s открывает практику и закрывается', (id) => {
    const onClose = vi.fn();
    render(<QuickActionOverlays active={id} {...base} onClose={onClose} />);
    fireEvent.click(screen.getByText(`practice-${id}`));
    expect(onClose).toHaveBeenCalled();
  });

  it('для каждого оверлейного действия что-то рисуется', async () => {
    for (const id of OVERLAY_QUICK_ACTIONS) {
      const { container, unmount } = render(<QuickActionOverlays active={id} {...base} />);
      await waitFor(() => expect(container.innerHTML).not.toBe(''));
      unmount();
    }
  });
});
