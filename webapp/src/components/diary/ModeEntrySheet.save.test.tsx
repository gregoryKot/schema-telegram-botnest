// @vitest-environment jsdom
// ModeEntrySheet — сохранение записи: успех (payload только заполненных
// полей, событие аналитики, экран «Запись сохранена»), отказ (правило
// CLAUDE.md — до фикса единственным сигналом была вибрация haptic.error(),
// которой на сайте в браузере вовсе нет: отказ был неотличим от успеха) и
// возврат из подсказки «разобрать связанный режим».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeEntrySheet } from './ModeEntrySheet';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheetOnFormStep(onSave: ReturnType<typeof vi.fn>, onClose = vi.fn()) {
  const utils = render(
    <MemoryRouter>
      <ModeEntrySheet onClose={onClose} onSave={onSave} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText('Знаю режим – выбрать из списка'));
  fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
  return { ...utils, onClose };
}

function fillSituation(text: string) {
  const textarea = screen.getByPlaceholderText(
    'Например: позвонил папа, начал расспрашивать про работу — и я чувствую, что «выключаюсь».',
  );
  fireEvent.change(textarea, { target: { value: text } });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => cleanup());

describe('ModeEntrySheet — успешное сохранение', () => {
  it('незаполненные поля уходят как undefined, а не пустая строка', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheetOnFormStep(onSave);
    fillSituation('Позвонил папа');
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'vulnerable_child',
        situation: 'Позвонил папа',
        thoughts: undefined,
        feelings: undefined,
        healthyResponse: undefined,
      }),
    );
  });

  it('после сохранения показывает экран «Запись сохранена», а не молча закрывает лист', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheetOnFormStep(onSave);
    fillSituation('Позвонил папа');
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });
    expect(screen.getByText('сохранена')).toBeTruthy();
  });

  it('отправляет событие аналитики сохранения записи', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheetOnFormStep(onSave);
    fillSituation('Позвонил папа');
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });
    expect(mockApi.trackEvent).toHaveBeenCalled();
  });
});

describe('ModeEntrySheet — отказ сохранения показывает ошибку пользователю', () => {
  it('провал onSave показывает текст ошибки, а НЕ закрывает лист молча', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network'));
    renderSheetOnFormStep(onSave);
    fillSituation('Позвонил папа');
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });
    // Регрессия: раньше единственным сигналом отказа была вибрация
    // (haptic.error()) — на сайте в браузере её вообще нет, и отказ был
    // неотличим от успеха. Теперь виден текст, роль status.
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/Не удалось сохранить/)).toBeTruthy();
    // Лист остаётся на форме — не «Запись сохранена».
    expect(screen.queryByText('сохранена')).toBeNull();
  });

  it('повторная попытка сохранения сбрасывает старую ошибку', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined);
    renderSheetOnFormStep(onSave);
    fillSituation('Позвонил папа');
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });
    expect(screen.getByRole('status')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('сохранена')).toBeTruthy();
  });
});

describe('ModeEntrySheet — подсказка «разобрать связанный режим»', () => {
  it('выбор конкретного кандидата шлёт событие сцепки и открывает форму нового режима с той же ситуацией', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheetOnFormStep(onSave);
    fillSituation('Позвонил папа');
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });
    expect(screen.getByText('сохранена')).toBeTruthy();

    fireEvent.click(screen.getByText('Требовательный Критик'));

    expect(mockApi.trackEvent).toHaveBeenCalledWith(
      'mode_chain_followup',
      { from: 'vulnerable_child', to: 'demanding_critic' },
    );
    // Форма снова открыта (не «Запись сохранена»), ситуация из прошлого шага сохранена.
    expect(screen.queryByText('сохранена')).toBeNull();
    expect(screen.getByDisplayValue('Позвонил папа')).toBeTruthy();
  });

  it('«Другой режим» возвращает к выбору режима и НЕ шлёт событие сцепки', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheetOnFormStep(onSave);
    fillSituation('Позвонил папа');
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });

    fireEvent.click(screen.getByText('Другой режим'));

    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'mode_chain_followup',
      expect.anything(),
    );
    expect(screen.getByText('Знаю режим – выбрать из списка')).toBeTruthy();
  });
});
