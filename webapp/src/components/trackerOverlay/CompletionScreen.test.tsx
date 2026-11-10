// @vitest-environment jsdom
// Экран «Готово» трекера: строка моста к терапевту подбирается по индексу дня.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CompletionScreen } from './CompletionScreen';
import type { Need } from '../../types';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
vi.mock('../../share/DayShareButton', () => ({ DayShareButton: () => null }));

afterEach(cleanup);

const IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];
const NEEDS: Need[] = IDS.map((id) => ({ id, emoji: '', title: id, chartLabel: id }));

function renderDone(value: number | null) {
  const ratings = value === null ? { attachment: 5 } : Object.fromEntries(IDS.map((id) => [id, value]));
  render(
    <MemoryRouter>
      <CompletionScreen needs={NEEDS} effectiveRatings={ratings} isBackfill={false} goBack={vi.fn()} onReview={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('CompletionScreen — мост к терапевту', () => {
  it('индекс дня ≤ 4: «Когда низко день за днём…»', () => {
    renderDone(4);
    expect(screen.getByText(/Когда низко день за днём, есть с кем поговорить/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Поговорить →' })).toBeTruthy();
  });

  it('индекс выше 4: «Если нужна терапия…»', () => {
    renderDone(7);
    expect(screen.getByText(/Трекер — самопомощь, не замена терапии\. Если нужна терапия/)).toBeTruthy();
  });

  it('оценены не все: индекса нет — общая формулировка', () => {
    renderDone(null);
    expect(screen.getByText(/Если нужна терапия, есть с кем поговорить/)).toBeTruthy();
  });

  it('экран «Готово» — цветная бумага: индекс и столбики без знака-полосок над ними (одна картинка, не две); кнопки — рядом с листом', () => {
    const { container } = render(
      <MemoryRouter>
        <CompletionScreen needs={NEEDS} effectiveRatings={{ attachment: 5 }} isBackfill={false} goBack={vi.fn()} onReview={vi.fn()} onOpenNote={vi.fn()} />
      </MemoryRouter>,
    );
    const sheet = container.querySelector('.pa-spread-side > .tq-day.pp-paper')!;
    expect(sheet.querySelector(':scope > svg')).toBeNull();
    expect(sheet.querySelector('.tq-bars')).toBeTruthy();
    const main = container.querySelector('.pa-spread-main')!;
    expect(main.querySelector('.ds-btn')?.textContent).toBe('На главную');
    // «Заметка» — строка со знаком заметки слева
    const note = Array.from(main.querySelectorAll('button.tq-go-row')).find((b) => b.textContent === 'Заметка')!;
    expect(note.querySelector('.pp-row-art svg')).toBeTruthy();
  });

  it('дооценка прошлого дня: заметки нет, главная кнопка — «Готово»', () => {
    render(
      <MemoryRouter>
        <CompletionScreen needs={NEEDS} effectiveRatings={{}} isBackfill date="2026-07-10" goBack={vi.fn()} onReview={vi.fn()} onOpenNote={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Заметка' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Готово' })).toBeTruthy();
    expect(screen.getByText('Трекер · 10 июля')).toBeTruthy();
  });

  it('оценки в офлайн-очереди: строка статуса через glue — предлоги не висят в конце строки', () => {
    render(
      <MemoryRouter>
        <CompletionScreen needs={NEEDS} effectiveRatings={{}} isBackfill={false} queued goBack={vi.fn()} onReview={vi.fn()} />
      </MemoryRouter>,
    );
    const status = screen.getByRole('status').textContent ?? '';
    expect(status.replace(/\u00a0/g, ' ')).toContain('Оценки пока не дошли до сервера');
    expect(status).toContain('до\u00a0сервера');
    expect(status).toContain('на\u00a0этом');
  });
});
