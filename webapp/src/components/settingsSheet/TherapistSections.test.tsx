// @vitest-environment jsdom
// «Мой терапевт» в настройках сайта: терапевт отказался от роли — над формой
// кода сообщение о нём (решение владельца 2026-10-22); при живой связи и при
// null с сервера — нет.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
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

function rel(
  therapyRelation: TherapyRelationInfo | null | undefined,
  over: { join?: Partial<Rel['join']>; leave?: Partial<Rel['leave']> } = {},
): Rel {
  return {
    therapyRelation,
    join: { code: '', setCode: vi.fn(), error: '', busy: false, joined: false, submit: vi.fn(), ...over.join },
    leave: { confirming: false, busy: false, failed: false, ask: vi.fn(), cancel: vi.fn(), confirm: vi.fn(), ...over.leave },
    invite: null,
    inviteCopied: false,
    inviteError: '',
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
    expect(screen.getByText('Подключиться')).toBeTruthy();
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
    expect(screen.getByText('Терапевт: Мария')).toBeTruthy();
    expect(getFormerTherapist).not.toHaveBeenCalled();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

const ACTIVE: TherapyRelationInfo = {
  role: 'client', status: 'active', partnerName: 'Анна Терапевт', partnerId: 9, code: 'ABC', nextSession: null,
};

// Инцидент 2026-10-26 (QA на стенде): поле пускало 8 знаков при коде из 12,
// кнопка звалась «Войти», статус был мужским родом, отключение — одним тапом.
describe('MyTherapistSection — подключение и отключение', () => {
  it('поле кода: пример из 12 знаков, предел с запасом под ссылку; ввод уходит в общий хук', () => {
    getFormerTherapist.mockResolvedValue(null);
    const r = rel(null);
    render(<MyTherapistSection rel={r} settings={settings} patch={patch} />);
    const input = screen.getByLabelText('Код от терапевта') as HTMLInputElement;
    expect(input.placeholder).toHaveLength(12);
    expect(input.maxLength).toBeGreaterThan(12);
    fireEvent.change(input, { target: { value: ' 7f3a9c21b04e ' } });
    expect(r.join.setCode).toHaveBeenCalledWith(' 7f3a9c21b04e ');
    fireEvent.click(screen.getByText('Подключиться'));
    expect(r.join.submit).toHaveBeenCalledTimes(1);
  });

  it('статус без рода: «Терапевт: Анна Терапевт», не «… подключён»', () => {
    render(<MyTherapistSection rel={rel(ACTIVE)} settings={settings} patch={patch} />);
    expect(screen.getByText('Терапевт: Анна Терапевт')).toBeTruthy();
    expect(screen.queryByText(/подключён/)).toBeNull();
  });

  it('только что подключились — сказано, что видит терапевт', () => {
    render(<MyTherapistSection rel={rel(ACTIVE, { join: { joined: true } })} settings={settings} patch={patch} />);
    expect(screen.getByRole('status').textContent).toMatch(/^Терапевт Анна Терапевт видит твой трекер/);
  });

  it('«Отключиться от терапевта» сначала спрашивает — сам тап связь не рвёт', () => {
    const r = rel(ACTIVE);
    render(<MyTherapistSection rel={r} settings={settings} patch={patch} />);
    fireEvent.click(screen.getByText('Отключиться от терапевта'));
    expect(r.leave.ask).toHaveBeenCalledTimes(1);
    expect(r.leave.confirm).not.toHaveBeenCalled();
  });

  it('диалог подтверждения: «Отключиться» — confirm, «Остаться» — cancel; ошибка видна', () => {
    const r = rel(ACTIVE, { leave: { confirming: true, failed: true } });
    render(withAddressForm(<MyTherapistSection rel={r} settings={settings} patch={patch} />, 'vy'));
    expect(screen.getByText('Отключиться от терапевта?')).toBeTruthy();
    expect(screen.getByText(/ваш трекер/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/Проверьте связь/);
    fireEvent.click(screen.getByText('Отключиться'));
    expect(r.leave.confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Остаться'));
    expect(r.leave.cancel).toHaveBeenCalledTimes(1);
  });
});
