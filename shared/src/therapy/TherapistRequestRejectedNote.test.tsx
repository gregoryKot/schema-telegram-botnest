// @vitest-environment jsdom
// Отказ по заявке психолога: блок виден только при status=rejected, несёт
// причину администратора и говорит, что подать можно снова — в форме человека.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../utils/addressForm';
import {
  TherapistRequestRejectedNote,
  rejectedRequestText,
} from './TherapistRequestRejectedNote';

afterEach(() => cleanup());

const ty = (t: string) => t;
const rejected = (rejectReason: string | null) => ({
  status: 'rejected',
  rejectReason,
});

describe('rejectedRequestText', () => {
  it('отказ с причиной — причина в тексте', () => {
    expect(rejectedRequestText(rejected('нет диплома'), ty)).toBe(
      'Прошлая заявка отклонена: нет диплома. Можешь подать новую.',
    );
  });

  it('отказ без причины (null или пробелы) — без висящего двоеточия', () => {
    expect(rejectedRequestText(rejected(null), ty)).toBe(
      'Прошлая заявка отклонена. Можешь подать новую.',
    );
    expect(rejectedRequestText(rejected('  '), ty)).toBe(
      'Прошлая заявка отклонена. Можешь подать новую.',
    );
  });

  it('не отказ — ничего', () => {
    for (const req of [
      null,
      undefined,
      { status: 'pending', rejectReason: null },
      { status: 'approved', rejectReason: null },
    ]) {
      expect(rejectedRequestText(req, ty)).toBeNull();
    }
  });
});

describe('TherapistRequestRejectedNote', () => {
  it('рисует отказ в форме «ты» по умолчанию', () => {
    render(<TherapistRequestRejectedNote request={rejected('мало опыта')} />);
    expect(screen.getByRole('note').textContent).toBe(
      'Прошлая заявка отклонена: мало опыта. Можешь подать новую.',
    );
  });

  it('форма «вы» из контекста', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: () => {} }}>
        <TherapistRequestRejectedNote request={rejected(null)} />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByRole('note').textContent).toContain(
      'Можете подать новую.',
    );
  });

  it('pending — пусто', () => {
    const { container } = render(
      <TherapistRequestRejectedNote
        request={{ status: 'pending', rejectReason: null }}
      />,
    );
    expect(container.textContent).toBe('');
  });
});
