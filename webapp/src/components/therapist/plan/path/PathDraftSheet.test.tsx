// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { phaseDraftsFromTemplate } from '../../../../../../shared/src/therapy/path/pathPlan';
import type { TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import { pathTemplate } from '../../../../../../shared/src/therapy/path/templates';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';
import { loadGuide } from '../../../../../../shared/src/therapy/conceptGraph/guideLoader';
import { PathDraftSheet } from './PathDraftSheet';
import { draftEmpty, pathDraftView } from './pathDraftView';

const h = vi.hoisted(() => ({ createPlanItems: vi.fn(), trackEvent: vi.fn() }));
vi.mock('../../../../api', () => ({ api: h, reportClientError: vi.fn() }));

const tr = (ty: string) => ty;
const template = pathTemplate(tr, 'general')!;
const path = {
  id: 1, clientId: '7', startDate: '2026-01-05', templateId: 'general', createdAt: '', updatedAt: '',
  phases: phaseDraftsFromTemplate(template).map((d, i) => ({
    ...d, id: i + 1, position: i, startedAt: null, endedAt: null, criteriaDone: [], note: '',
  })),
} as TherapyPath;
const planItem = (sourceAddress: string) => ({ id: 9, sourceAddress, source: null }) as PlanItem;
const base = { path, template, modeIds: ['detached_protector', 'vulnerable_child'], schemaIds: [] as string[], items: [] as PlanItem[] };
const fns = { onOpen: vi.fn(), onOpenConcept: vi.fn(), onAdded: vi.fn() };
const show = (over: Partial<typeof base> = {}) =>
  render(<MemoryRouter><PathDraftSheet clientId={7} {...base} {...over} {...fns} onClose={() => {}} /></MemoryRouter>);
const addButton = (n: number) => screen.findByRole('button', { name: `Добавить выбранное (${n})` });

beforeEach(() => {
  vi.clearAllMocks();
  h.createPlanItems.mockResolvedValue({ items: [] });
});

describe('pathDraftView', () => {
  it('предложения с названием статьи, подписью «откуда» и фазой; статья из плана не предлагается', async () => {
    const guide = await loadGuide();
    const groups = pathDraftView(guide, tr, base);
    const rows = groups.flatMap((g) => g.rows);
    const own = rows.find((r) => r.address === 'mode:detached_protector/goal')!;
    expect(own).toMatchObject({ title: 'Отстранённый Защитник', why: 'режим Отстранённый Защитник → статья режима', phaseId: 2, open: { kind: 'mode', id: 'detached_protector' } });
    expect(groups[0].phaseName).toBe(path.phases[1].name);
    const technique = rows.find((r) => r.open.kind === 'technique')!;
    expect(technique.why).toMatch(/^режим .+ → техника$/);
    const without = pathDraftView(guide, tr, { ...base, items: [planItem(`technique:${technique.open.id}/when`)] });
    expect(without.flatMap((g) => g.rows).some((r) => r.address === technique.address)).toBe(false);
  });

  it('причина пустого листа: нет концептуализации, нет фаз шаблона, всё уже в плане', async () => {
    const guide = await loadGuide();
    expect(draftEmpty([], { ...base, modeIds: [] })).toBe('no-concept');
    const own = { ...path, phases: path.phases.map((p) => ({ ...p, templatePhaseId: null })) };
    expect(draftEmpty([], { ...base, path: own })).toBe('no-template');
    expect(draftEmpty([], base)).toBe('nothing');
    expect(draftEmpty(pathDraftView(guide, tr, base), base)).toBeNull();
  });
});

describe('PathDraftSheet — «Предложить по концептуализации»', () => {
  it('ничего не отмечено заранее: кнопка выключена, запросов нет', async () => {
    show();
    const button = await addButton(0);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('checkbox').every((c) => !(c as HTMLInputElement).checked)).toBe(true);
    expect(h.createPlanItems).not.toHaveBeenCalled();
  });

  it('отмеченное уходит пунктами с фазой и адресом источника, план перечитывается', async () => {
    show();
    fireEvent.click(await screen.findByRole('checkbox', { name: /^Отстранённый Защитник/ }));
    fireEvent.click(await addButton(1));
    await waitFor(() => expect(fns.onAdded).toHaveBeenCalledTimes(1));
    expect(h.createPlanItems.mock.calls).toEqual([[
      { clientIds: ['7'], rubric: 'session', text: 'Отстранённый Защитник', sourceAddress: 'mode:detached_protector/goal', phaseId: 2 },
    ]]);
    expect(screen.getByText('Добавлено в план: 1.')).toBeTruthy();
  });

  it('сбой посередине: созданное остаётся, видно сколько добавлено', async () => {
    h.createPlanItems.mockResolvedValueOnce({ items: [] }).mockRejectedValueOnce(new Error('net'));
    show();
    const boxes = await screen.findAllByRole('checkbox');
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    fireEvent.click(await addButton(2));
    expect((await screen.findByRole('alert')).textContent).toContain('Добавлено 1 из 2');
    expect(fns.onAdded).toHaveBeenCalledTimes(1);
  });

  it('«Открыть» ведёт на лист статьи справочника', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Отстранённый Защитник — открыть в справочнике' }));
    expect(fns.onOpen).toHaveBeenCalledWith({ kind: 'mode', id: 'detached_protector' });
  });

  it('нет режимов и схем — объяснение и переход в концептуализацию вместо списка', async () => {
    show({ modeIds: [] });
    expect(await screen.findByRole('button', { name: 'Открыть концептуализацию' })).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
