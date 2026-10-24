// @vitest-environment jsdom
// Карточка «Терапевт» профиля: при живой связи — терапевт; связи нет, а
// терапевт отказался от роли — сообщение о бывшем (решение владельца 2026-10-22).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { TherapyRelationInfo } from '../../api';

const getFormerTherapist = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ api: { getFormerTherapist } }));

import { TherapistCard } from './TherapistCard';

afterEach(() => {
  cleanup();
  getFormerTherapist.mockReset();
});

const active: TherapyRelationInfo = {
  role: 'client',
  status: 'active',
  partnerName: 'Мария',
  partnerId: 9,
  code: 'ABC',
  nextSession: null,
};

describe('TherapistCard', () => {
  it('связи нет, бывший терапевт есть — сообщение с именем', async () => {
    getFormerTherapist.mockResolvedValue({ name: 'Анна', endedAt: null });
    render(<TherapistCard relation={null} />);
    expect(
      await screen.findByText('Анна больше не работает в приложении как терапевт'),
    ).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('Подключить другого терапевта можно по коду');
  });

  it('связи нет и бывшего нет (null) — пусто', async () => {
    getFormerTherapist.mockResolvedValue(null);
    const { container } = render(<TherapistCard relation={null} />);
    await waitFor(() => expect(getFormerTherapist).toHaveBeenCalledTimes(1));
    expect(container.textContent).toBe('');
  });

  it('связь активна — карточка терапевта, бывшего не спрашиваем', () => {
    render(<TherapistCard relation={active} />);
    expect(screen.getByText('Мария')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    expect(getFormerTherapist).not.toHaveBeenCalled();
  });
});
