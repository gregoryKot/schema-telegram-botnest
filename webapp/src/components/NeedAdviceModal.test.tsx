// @vitest-environment jsdom
// NeedAdviceModal — общий оверлей «О советах» под шитами потребности
// (0% покрытия). Ключевой инвариант: терапевту не предлагаем ссылку на
// самого себя (isTherapist=true скрывает CTA) — регрессия здесь означает,
// что терапевт видит нелепую кнопку «Написать себе».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedAdviceModal } from './NeedAdviceModal';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('NeedAdviceModal', () => {
  it('рендерит объяснение назначения советов', () => {
    render(<NeedAdviceModal onClose={vi.fn()} />);
    expect(screen.getByText('О советах')).toBeTruthy();
    expect(screen.getByText(/Советы внутри — это приглашение к размышлению/)).toBeTruthy();
  });

  it('обычный клиент видит CTA «Поговорить с психологом»', () => {
    render(<NeedAdviceModal onClose={vi.fn()} />);
    expect(screen.getByText('→ Поговорить с психологом')).toBeTruthy();
  });

  it('сам терапевт не видит CTA на самого себя', () => {
    localStorage.setItem('therapy_contact_url', 'https://t.me/someone');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    render(<NeedAdviceModal onClose={vi.fn()} />);
    expect(screen.queryByText('→ Поговорить с психологом')).toBeNull();
  });

  it('клик по фону закрывает оверлей', () => {
    const onClose = vi.fn();
    render(<NeedAdviceModal onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });

  it('клик по самой карточке НЕ закрывает оверлей (stopPropagation)', () => {
    const onClose = vi.fn();
    render(<NeedAdviceModal onClose={onClose} />);
    fireEvent.click(screen.getByText('О советах'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
