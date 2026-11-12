// @vitest-environment jsdom
// Связки колеса потребностей (владелец 2026-11-10): «Колесо детства», которое клиент проходит
// сам, и концептуализация — какие схемы блокируют потребность, какой здоровый режим заботится.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WheelChildhood, WheelConceptLine } from './WheelLinks';
import { ModeMapConceptContext, type ClientConceptState } from './clientConceptContext';
import { needInConcept } from './wheelConcept';

const getTherapyClientData = vi.fn();
vi.mock('../../api', () => ({ api: { getTherapyClientData: (...a: unknown[]) => getTherapyClientData(...a) } }));

beforeEach(() => { getTherapyClientData.mockReset(); });

describe('WheelChildhood — «Колесо детства» клиента', () => {
  it('без клиента ничего не грузит и не рисует', () => {
    const { container } = render(<WheelChildhood links={[]} onApply={vi.fn()} />);
    expect(container.textContent).toBe('');
    expect(getTherapyClientData).not.toHaveBeenCalled();
  });

  it('оценки клиента в процентах; «Поставить на колесо» кладёт их в период детства колеса клиента', async () => {
    getTherapyClientData.mockResolvedValue({ childhoodRatings: { attachment: 3, play: 8 } });
    const onApply = vi.fn();
    render(<WheelChildhood clientId={7} links={[{ needId: 'attachment', ratings: { now: 6 }, notes: {} }]} onApply={onApply} />);
    expect(await screen.findByText('Привязанность 30% · Спонтанность 80%')).toBeTruthy();
    fireEvent.click(screen.getByText('Поставить на колесо'));
    expect(onApply).toHaveBeenCalledWith([
      { needId: 'attachment', ratings: { now: 6, child: 3 }, notes: {} },
      { needId: 'play', ratings: { child: 8 }, notes: {} },
    ]);
  });

  it('уже перенесено — кнопки нет, так и сказано', async () => {
    getTherapyClientData.mockResolvedValue({ childhoodRatings: { attachment: 3 } });
    render(<WheelChildhood clientId={7} links={[{ needId: 'attachment', ratings: { child: 3 }, notes: {} }]} onApply={vi.fn()} />);
    expect(await screen.findByText('Уже стоит на колесе.')).toBeTruthy();
    expect(screen.queryByText('Поставить на колесо')).toBeNull();
  });

  it('оценок нет — честно: не проходил или закрыл профиль; не выдуманные цифры', async () => {
    getTherapyClientData.mockResolvedValue({ childhoodRatings: {} });
    render(<WheelChildhood clientId={7} links={[]} onApply={vi.fn()} />);
    expect(await screen.findByText(/ещё не проходил упражнение/)).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('сбой загрузки — «Повторить» запрашивает заново', async () => {
    getTherapyClientData.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ childhoodRatings: { limits: 5 } });
    render(<WheelChildhood clientId={7} links={[]} onApply={vi.fn()} />);
    fireEvent.click(await screen.findByText('Повторить'));
    await waitFor(() => expect(screen.getByText('Границы 50%')).toBeTruthy());
    expect(getTherapyClientData).toHaveBeenCalledTimes(2);
  });
});

const link = (modeId: string, needIds: string[]) => ({ modeId, alias: '', schemaIds: [], needIds, origin: '', manifest: '', strategy: '' });
const CONCEPT: ClientConceptState = {
  schemaIds: ['abandonment'], modeIds: ['healthy_adult', 'vulnerable_child'],
  modeLinks: [link('healthy_adult', ['attachment']), link('vulnerable_child', ['attachment'])],
  schemaLinks: [{ schemaId: 'abandonment', belief: '', origin: '', needIds: ['attachment'] }],
};

describe('концептуализация о потребности', () => {
  it('✗ — схемы, которые её блокируют; ✓ — только здоровые режимы', () => {
    const r = needInConcept(CONCEPT, 'attachment');
    expect(r.blocks).toEqual(['Покинутость / Нестабильность']);
    expect(r.meets).toHaveLength(1);
    expect(needInConcept(CONCEPT, 'play')).toEqual({ blocks: [], meets: [] });
    expect(needInConcept('failed', 'attachment')).toEqual({ blocks: [], meets: [] });
  });

  it('строка в панели: связи из концептуализации, а без них — как их провести', () => {
    const { container, rerender } = render(
      <ModeMapConceptContext.Provider value={CONCEPT}><WheelConceptLine needId="attachment" /></ModeMapConceptContext.Provider>,
    );
    expect(container.textContent).toContain('✗ блокирует: Покинутость / Нестабильность');
    expect(container.textContent).toContain('✓ заботится:');
    rerender(<ModeMapConceptContext.Provider value={CONCEPT}><WheelConceptLine needId="play" /></ModeMapConceptContext.Provider>);
    expect(container.textContent).toContain('пока ни с чем не связана');
  });

  it('концептуализация не загрузилась — строки нет', () => {
    const { container } = render(
      <ModeMapConceptContext.Provider value="failed"><WheelConceptLine needId="play" /></ModeMapConceptContext.Provider>,
    );
    expect(container.textContent).toBe('');
  });
});
