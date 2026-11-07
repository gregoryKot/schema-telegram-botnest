// @vitest-environment jsdom
// «Справочник» терапевта (#995, шаг 4): чанк текстов не доехал — вместо
// вечного силуэта тихая строка и «Повторить»; повтор — новая попытка
// загрузки (снова силуэт), а не тот же отказ мгновенно.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapistGuideSection } from './TherapistGuideSection';

vi.mock('../../../shared/src/schemaTherapy/guide', () => {
  throw new Error('chunk failed');
});
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

describe('TherapistGuideSection: тексты не загрузились', () => {
  it('тихое сообщение и «Повторить» — новая попытка', async () => {
    const { container } = render(<MemoryRouter><TherapistGuideSection /></MemoryRouter>);
    expect(container.querySelector('.skel')).not.toBeNull();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Справочник не загрузился');
    expect(container.querySelector('.skel')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(container.querySelector('.skel')).not.toBeNull();
    expect(await screen.findByRole('alert')).toBeTruthy();
    // объяснение «откуда и зачем» на месте и при сбое
    expect(screen.getByRole('heading', { name: 'Справочник' })).toBeTruthy();
  });
});
