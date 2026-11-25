// @vitest-environment jsdom
// «Записано»: ссылка на карточку выбранного режима/схемы, событие done_next_step; без тега ссылки нет.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuickDone } from './QuickDone';
import { quickDoneNext } from './quickDoneView';

const openPattern = vi.fn();
vi.mock('../../../sections/schemas/usePatternLayer', () => ({
  usePatternLayer: () => ({ layer: null, openPattern }),
}));
const track = vi.fn();
vi.mock('../../../sections/today/trackHomeTile', () => ({ trackDoneNextStep: (m: unknown) => track(m) }));
vi.mock('../../therapy/useTherapyBridgeTexts', () => ({ useTherapyBridgeTexts: () => ({ lineDiary: '' }) }));

const renderDone = (saved: Parameters<typeof QuickDone>[0]['saved']) =>
  render(<MemoryRouter><QuickDone saved={saved} crisis={false} onHome={vi.fn()} onAgain={vi.fn()} /></MemoryRouter>);

beforeEach(() => { cleanup(); vi.clearAllMocks(); });

describe('QuickDone: следующий шаг', () => {
  it('режим: ссылка открывает карточку режима и шлёт событие', () => {
    renderDone({ tag: 'mode', modeId: 'vulnerable_child' });
    fireEvent.click(screen.getByRole('button', { name: /Открыть карточку/ }));
    expect(openPattern).toHaveBeenCalledWith('mode', 'vulnerable_child');
    expect(track).toHaveBeenCalledWith({ from: 'diary', to: 'mode' });
  });

  it('схема: ссылка открывает карточку первой схемы и шлёт событие', () => {
    renderDone({ tag: 'schema', schemaIds: ['mistrust'] });
    fireEvent.click(screen.getByRole('button', { name: /Открыть карточку/ }));
    expect(openPattern).toHaveBeenCalledWith('schema', 'mistrust');
    expect(track).toHaveBeenCalledWith({ from: 'diary', to: 'schema' });
  });

  it('ничего не отмечено — ссылки нет', () => {
    renderDone({ tag: 'thought' });
    expect(screen.queryByRole('button', { name: /Открыть карточку/ })).toBeNull();
    renderDone({ tag: 'schema', schemaIds: [] });
    expect(screen.queryByRole('button', { name: /Открыть карточку/ })).toBeNull();
    expect(quickDoneNext({ tag: 'mode', modeId: 'нет_такого' })).toBeNull();
  });
});
