// @vitest-environment jsdom
// «Критик или забота?» на сайте (дизайн-аудит 2026-08, В2 — раньше только в
// мини-аппе). Логика вердикта/примет — в shared и уже покрыта своими тестами
// (phraseCheck/verdict.test.ts, criteria.test.ts); здесь проверяем то, что
// принадлежит webapp-обвязке: прохождение шагов, кризисный гейт ДО сохранения
// (правило №7), реальный вызов api.createPhraseCheck, пустая история на
// чистом аккаунте (без хардкод-заглушек, CLAUDE.md).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PhraseCheckEx } from './PhraseCheckEx';
import { AddressFormContext } from '../../utils/addressForm';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';
import { PHRASE_CRITERIA } from '../../../../shared/src/phraseCheck/criteria';

vi.mock('../../api', () => ({
  api: {
    getPhraseChecks: vi.fn(),
    createPhraseCheck: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderEx(onComplete?: () => void) {
  return render(
    <MemoryRouter>
      <PhraseCheckEx onBack={vi.fn()} onComplete={onComplete} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPhraseChecks.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

function enterPhrase(text: string) {
  fireEvent.change(
    screen.getByPlaceholderText('Например: опять всё завалила, ни на что не гожусь'),
    { target: { value: text } },
  );
  fireEvent.click(screen.getByText('Проверить'));
}

/** Отвечает «критик» на все девять примет по очереди. */
function walkAllCritic() {
  for (const c of PHRASE_CRITERIA) {
    fireEvent.click(screen.getByText(c.critic));
  }
}

describe('PhraseCheckEx — кризисная детекция ДО сохранения (правило №7)', () => {
  it('кризисная фраза на шаге ввода показывает CrisisCard', () => {
    renderEx();
    fireEvent.change(
      screen.getByPlaceholderText('Например: опять всё завалила, ни на что не гожусь'),
      { target: { value: 'не хочу жить' } },
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральная фраза не показывает CrisisCard', () => {
    renderEx();
    fireEvent.change(
      screen.getByPlaceholderText('Например: опять всё завалила, ни на что не гожусь'),
      { target: { value: 'опять забыл про встречу' } },
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('кризисный текст в переписанной фразе (шаг переписать) тоже показывает CrisisCard', () => {
    renderEx();
    enterPhrase('я ни на что не гожусь');
    walkAllCritic();
    fireEvent.change(
      screen.getByPlaceholderText(/Например: отчёт ушёл с ошибкой/),
      { target: { value: 'не хочу жить' } },
    );
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('PhraseCheckEx — вердикт по приметам', () => {
  it('все девять примет отмечены критиком → вердикт «Говорит критик»', () => {
    renderEx();
    enterPhrase('я ни на что не гожусь');
    walkAllCritic();
    expect(screen.getByText(/Говорит критик/)).toBeTruthy();
  });

  it('ни одна примета не критик → вердикт «Это самокоррекция», без предложения переписать', () => {
    renderEx();
    enterPhrase('в отчёте была ошибка, поправлю в следующий раз');
    for (const c of PHRASE_CRITERIA) {
      fireEvent.click(screen.getByText(c.care));
    }
    expect(screen.getByText(/Это самокоррекция/)).toBeTruthy();
    expect(screen.getByText('Можно сохранить как есть')).toBeTruthy();
  });
});

describe('PhraseCheckEx — сохранение вызывает реальный api', () => {
  it('успешное сохранение вызывает createPhraseCheck с фразой/приметами/переписью, показывает «Разобрано», вызывает onComplete', async () => {
    mockApi.createPhraseCheck.mockResolvedValue(undefined);
    const onComplete = vi.fn();
    renderEx(onComplete);

    enterPhrase('я ни на что не гожусь');
    walkAllCritic();
    fireEvent.change(
      screen.getByPlaceholderText(/Например: отчёт ушёл с ошибкой/),
      { target: { value: 'в этот раз не получилось, поправимо' } },
    );
    await act(async () => {
      fireEvent.click(screen.getByText(/Сохранить разбор/));
    });

    await screen.findByText('Разобрано.');
    expect(mockApi.createPhraseCheck).toHaveBeenCalledWith({
      phrase: 'я ни на что не гожусь',
      marks: PHRASE_CRITERIA.map((c) => c.id),
      rewrite: 'в этот раз не получилось, поправимо',
      inWarmWords: true,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  // Регрессия: реф­акторинг на общий usePhraseCheckState (shared) один раз
  // уже сломал «Проверить ещё одну» — again() звал setMarks, которого не
  // было в новом наборе деструктуризации (ReferenceError на клике).
  it('«Проверить ещё одну» возвращает на пустой шаг ввода без падения', async () => {
    mockApi.createPhraseCheck.mockResolvedValue(undefined);
    renderEx();

    enterPhrase('я ни на что не гожусь');
    walkAllCritic();
    fireEvent.change(
      screen.getByPlaceholderText(/Например: отчёт ушёл с ошибкой/),
      { target: { value: 'переформулировка' } },
    );
    await act(async () => {
      fireEvent.click(screen.getByText(/Сохранить разбор/));
    });
    await screen.findByText('Разобрано.');

    fireEvent.click(screen.getByText('Проверить ещё одну'));

    expect(
      screen.getByPlaceholderText('Например: опять всё завалила, ни на что не гожусь'),
    ).toBeTruthy();
    expect((screen.getByPlaceholderText('Например: опять всё завалила, ни на что не гожусь') as HTMLTextAreaElement).value).toBe('');
  });

  it('отказ сети НЕ показывает «Разобрано», показывает ошибку, текст не теряется', async () => {
    mockApi.createPhraseCheck.mockRejectedValue(new Error('network down'));
    renderEx();

    enterPhrase('я ни на что не гожусь');
    walkAllCritic();
    fireEvent.change(
      screen.getByPlaceholderText(/Например: отчёт ушёл с ошибкой/),
      { target: { value: 'переформулировка' } },
    );
    await act(async () => {
      fireEvent.click(screen.getByText(/Сохранить разбор/));
    });

    await screen.findByText(/Не удалось сохранить разбор/);
    expect(screen.queryByText('Разобрано.')).toBeNull();
    expect(screen.getByDisplayValue('переформулировка')).toBeTruthy();
  });
});

describe('PhraseCheckEx — история: реальные данные, не заглушка', () => {
  it('чистый аккаунт: «Прошлые разборы» не показываются вовсе (не «0 разборов»)', async () => {
    renderEx();
    await waitFor(() => expect(mockApi.getPhraseChecks).toHaveBeenCalled());
    expect(screen.queryByText(/Прошлые разборы/)).toBeNull();
  });

  it('с реальными прошлыми разборами — показывает их дословно', async () => {
    mockApi.getPhraseChecks.mockResolvedValue([
      { id: 1, phrase: 'старая фраза', marks: ['worth'], rewrite: 'старый ответ', inWarmWords: false, createdAt: new Date().toISOString() },
    ]);
    renderEx();
    await screen.findByText(/Прошлые разборы · 1/);
    expect(screen.getByText(/«старая фраза»/)).toBeTruthy();
  });
});

describe('PhraseCheckEx — ты/вы', () => {
  it('вступление звучит на «ты»', () => {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
          <PhraseCheckEx onBack={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/^Запиши фразу, которую сказал себе/)).toBeTruthy();
  });

  it('вступление звучит на «вы»', () => {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
          <PhraseCheckEx onBack={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/^Запишите фразу, которую сказали себе/)).toBeTruthy();
  });
});
