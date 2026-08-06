// @vitest-environment jsdom
// BecomeTherapistSection — часть 1/2 (правило №10 — файл ≤300 строк):
// статусы заявки, открытие/заполнение формы. Отправка (успех/ошибка) — в
// BecomeTherapistSection.submit.test.tsx. Кнопка отправки заблокирована,
// пока обязательные поля пустые — читаемо только через disabled, не только
// через opacity.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BecomeTherapistSection } from './BecomeTherapistSection';

// Часть 1/2 не зовёт api (статусы приходят пропом, форма ещё не отправляется)
// — реальный api не нужен, но мокаем на случай побочного импорта модуля.
vi.mock('../../api', () => ({
  api: { submitTherapistRequest: vi.fn(), getTherapistRequest: vi.fn() },
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

function baseProps(
  overrides: Partial<Parameters<typeof BecomeTherapistSection>[0]> = {},
) {
  return {
    therapistReq: null,
    setTherapistReq: vi.fn(),
    showReqForm: false,
    setShowReqForm: vi.fn(),
    reqFullName: '',
    setReqFullName: vi.fn(),
    reqQual: '',
    setReqQual: vi.fn(),
    reqContacts: '',
    setReqContacts: vi.fn(),
    reqMsg: '',
    setReqMsg: vi.fn(),
    reqBusy: false,
    setReqBusy: vi.fn(),
    reqError: '',
    setReqError: vi.fn(),
    ...overrides,
  };
}

describe('BecomeTherapistSection — статусы заявки', () => {
  it('therapistReq=undefined (ещё грузится) — ничего не рендерит', () => {
    const { container } = render(
      <BecomeTherapistSection {...baseProps({ therapistReq: undefined })} />,
    );
    expect(container.textContent).toBe('');
  });

  it('therapistReq.status=pending — показывает «Заявка отправлена»', () => {
    render(
      <BecomeTherapistSection
        {...baseProps({
          therapistReq: { id: 1, status: 'pending', rejectReason: null },
        })}
      />,
    );
    expect(screen.getByText('Заявка отправлена')).toBeTruthy();
  });

  it('therapistReq.status=approved — показывает «Заявка одобрена»', () => {
    render(
      <BecomeTherapistSection
        {...baseProps({
          therapistReq: { id: 1, status: 'approved', rejectReason: null },
        })}
      />,
    );
    expect(screen.getByText('✓ Заявка одобрена')).toBeTruthy();
  });

  it('therapistReq=null, showReqForm=false — кнопка «Я психолог — подать заявку»', () => {
    render(<BecomeTherapistSection {...baseProps()} />);
    fireEvent.click(screen.getByText(/Я психолог/));
    // клик просто зовёт setShowReqForm — проверяется отдельно ниже
  });
});

describe('BecomeTherapistSection — открытие формы', () => {
  it('клик по кнопке зовёт setShowReqForm(true)', () => {
    const setShowReqForm = vi.fn();
    render(<BecomeTherapistSection {...baseProps({ setShowReqForm })} />);
    fireEvent.click(screen.getByText(/Я психолог/));
    expect(setShowReqForm).toHaveBeenCalledWith(true);
  });
});

describe('BecomeTherapistSection — форма заявки', () => {
  it('ввод в поля зовёт соответствующие сеттеры', () => {
    const setReqFullName = vi.fn();
    render(
      <BecomeTherapistSection
        {...baseProps({ showReqForm: true, setReqFullName })}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Мария Иванова'), {
      target: { value: 'Анна Смирнова' },
    });
    expect(setReqFullName).toHaveBeenCalledWith('Анна Смирнова');
  });

  it('обязательные поля пустые — кнопка «Отправить» disabled', () => {
    render(<BecomeTherapistSection {...baseProps({ showReqForm: true })} />);
    const btn = screen.getByText('Отправить');
    expect(btn.disabled).toBe(true);
  });

  it('все обязательные поля заполнены — кнопка «Отправить» активна', () => {
    render(
      <BecomeTherapistSection
        {...baseProps({
          showReqForm: true,
          reqFullName: 'Анна Смирнова',
          reqQual: 'Схема-терапевт',
          reqContacts: '@anna',
        })}
      />,
    );
    const btn = screen.getByText('Отправить');
    expect(btn.disabled).toBe(false);
  });

  it('клик «Отмена» закрывает форму и сбрасывает ошибку', () => {
    const setShowReqForm = vi.fn();
    const setReqError = vi.fn();
    render(
      <BecomeTherapistSection
        {...baseProps({ showReqForm: true, setShowReqForm, setReqError })}
      />,
    );
    fireEvent.click(screen.getByText('Отмена'));
    expect(setShowReqForm).toHaveBeenCalledWith(false);
    expect(setReqError).toHaveBeenCalledWith('');
  });

  it('reqBusy=true — кнопка показывает «...»', () => {
    render(
      <BecomeTherapistSection
        {...baseProps({
          showReqForm: true,
          reqFullName: 'A',
          reqQual: 'B',
          reqContacts: 'C',
          reqBusy: true,
        })}
      />,
    );
    expect(screen.getByText('...')).toBeTruthy();
  });

  it('reqError задан — показывает текст ошибки', () => {
    render(
      <BecomeTherapistSection
        {...baseProps({ showReqForm: true, reqError: 'Заявка уже отправлена' })}
      />,
    );
    expect(screen.getByText('Заявка уже отправлена')).toBeTruthy();
  });
});
