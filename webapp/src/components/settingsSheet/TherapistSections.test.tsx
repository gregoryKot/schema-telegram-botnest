// @vitest-environment jsdom
// «Мой терапевт» в настройках сайта: терапевт отказался от роли — над формой
// кода сообщение о нём (решение владельца 2026-10-22); при живой связи и при
// null с сервера — нет.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { TherapyRelationInfo, UserSettings } from '../../api';
import { withAddressForm } from './SettingsSheet.test-helpers';

const getFormerTherapist = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ api: { getFormerTherapist } }));

import { MyTherapistSection } from './TherapistSections';
import type { useTherapyRelationSettings } from './useTherapyRelationSettings';

afterEach(() => {
  cleanup();
  getFormerTherapist.mockReset();
});

type Rel = ReturnType<typeof useTherapyRelationSettings>;

function rel(therapyRelation: TherapyRelationInfo | null | undefined): Rel {
  return {
    therapyRelation,
    therapyJoinCode: '',
    setTherapyJoinCode: vi.fn(),
    therapyJoinError: '',
    leaveTherapyError: false,
    therapyInviteUrl: '',
    inviteCopied: false,
    inviteError: false,
    leaveTherapy: vi.fn(),
    joinTherapy: vi.fn(),
    createInvite: vi.fn(),
  } as unknown as Rel;
}

const settings = {} as UserSettings;
const patch = vi.fn();

describe('MyTherapistSection — бывший терапевт', () => {
  it('связи нет, бывший есть — сообщение над формой кода, в форме «вы»', async () => {
    getFormerTherapist.mockResolvedValue({ name: 'Анна', endedAt: '2026-10-22T10:00:00.000Z' });
    render(withAddressForm(<MyTherapistSection rel={rel(null)} settings={settings} patch={patch} />, 'vy'));
    expect(await screen.findByText('Анна больше не работает в приложении как терапевт')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('остаётся у вас');
    expect(screen.getByText('Войти')).toBeTruthy();
  });

  it('связи нет, сервер отдал null — без сообщения', async () => {
    getFormerTherapist.mockResolvedValue(null);
    render(<MyTherapistSection rel={rel(null)} settings={settings} patch={patch} />);
    await waitFor(() => expect(getFormerTherapist).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('терапевт подключён — бывшего не спрашиваем и не показываем', () => {
    const active: TherapyRelationInfo = {
      role: 'client', status: 'active', partnerName: 'Мария', partnerId: 9, code: 'ABC', nextSession: null,
    };
    render(<MyTherapistSection rel={rel(active)} settings={settings} patch={patch} />);
    expect(screen.getByText('Мария подключён')).toBeTruthy();
    expect(getFormerTherapist).not.toHaveBeenCalled();
    expect(screen.queryByRole('note')).toBeNull();
  });
});
