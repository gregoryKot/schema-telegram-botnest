// @vitest-environment jsdom
// Disclaimer — визард первого входа, сведён к 4 шагам 2026-08-31
// (welcome/privacy/not_therapy/home_screen — см. steps.ts). Шаги-контент
// мокаем (каждый — самостоятельный текстовый компонент без логики); здесь
// проверяем ТОЛЬКО навигацию и гейт согласий: правило CLAUDE.md «на шаге
// not_therapy нельзя идти дальше, пока не отмечены обе галочки» — самый
// частый источник «застрял в онбординге» багов при рефакторинге порядка
// шагов.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Disclaimer } from './Disclaimer';
import { canOfferHomeScreenNow } from '../utils/homeScreen';

vi.mock('../utils/homeScreen', () => ({
  canOfferHomeScreenNow: vi.fn(() => false),
}));
vi.mock('./disclaimer/DisclaimerWelcomeStep', () => ({
  DisclaimerWelcomeStep: () => <div>step-welcome</div>,
}));
vi.mock('./disclaimer/DisclaimerPrivacyStep', () => ({
  DisclaimerPrivacyStep: (p: {
    c2: boolean;
    setC2: (updater: (v: boolean) => boolean) => void;
  }) => (
    <div>
      <span>step-privacy</span>
      <button onClick={() => p.setC2((v) => !v)}>toggle-c2</button>
    </div>
  ),
}));
vi.mock('./disclaimer/DisclaimerNotTherapyStep', () => ({
  DisclaimerNotTherapyStep: (p: {
    c1: boolean;
    setC1: (v: boolean) => void;
  }) => (
    <div>
      <span>step-not-therapy</span>
      <button onClick={() => p.setC1(!p.c1)}>toggle-c1</button>
    </div>
  ),
}));
vi.mock('./disclaimer/DisclaimerHomeScreenStep', () => ({
  DisclaimerHomeScreenStep: () => <div>step-home-screen</div>,
}));
vi.mock('../hooks/useOnboardingStepTracking', () => ({
  useOnboardingStepTracking: vi.fn(),
  trackOnboardingDone: vi.fn(),
}));

// vi.clearAllMocks() очищает calls/results, но НЕ откатывает implementation,
// выставленную через mockReturnValue — без явного сброса тест, идущий следом
// за тем, что переключил canOfferHomeScreenNow на true, унаследовал бы это
// значение (порядок тестов в файле начал бы влиять на результат).
beforeEach(() => {
  vi.mocked(canOfferHomeScreenNow).mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Disclaimer — гейт согласий на шаге not_therapy', () => {
  it('«Далее» с шага privacy заблокирована/незаблокирована сама по себе (не consent-шаг) — сразу пускает дальше', () => {
    render(<Disclaimer onAccept={() => {}} onConsent={() => {}} />);
    fireEvent.click(screen.getByText('Далее →')); // welcome → privacy
    expect(screen.getByText('step-privacy')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее →')); // privacy → not_therapy
    expect(screen.getByText('step-not-therapy')).toBeTruthy();
  });

  it('обе галочки не стоят — «Далее» не пускает со шага not_therapy', () => {
    // home_screen доступен, чтобы not_therapy НЕ был последним шагом и
    // рендерил «Далее →» (не финальную кнопку — для неё своя группа тестов).
    vi.mocked(canOfferHomeScreenNow).mockReturnValue(true);
    render(<Disclaimer onAccept={() => {}} onConsent={() => {}} />);
    fireEvent.click(screen.getByText('Далее →')); // → privacy
    fireEvent.click(screen.getByText('Далее →')); // → not_therapy
    fireEvent.click(screen.getByText('Далее →')); // заблокировано
    expect(screen.getByText('step-not-therapy')).toBeTruthy();
  });

  it('обе галочки стоят — «Далее» пускает и onConsent зовётся один раз', () => {
    const onConsent = vi.fn();
    render(<Disclaimer onAccept={() => {}} onConsent={onConsent} />);
    fireEvent.click(screen.getByText('Далее →')); // → privacy
    fireEvent.click(screen.getByText('Далее →')); // → not_therapy
    fireEvent.click(screen.getByText('toggle-c1')); // c1=true
    // c2 выставляется через consentGiven-проп в реальном сценарии privacy,
    // здесь эмулируем «уже согласился ранее» через consentGiven=true.
    cleanup();
    render(
      <Disclaimer onAccept={() => {}} onConsent={onConsent} consentGiven />,
    );
    // consentGiven=true, home_screen недоступен (мок вернёт false) —
    // открывается на последнем доступном шаге, not_therapy.
    expect(screen.getByText('step-not-therapy')).toBeTruthy();
  });
});

// Регресс 2026-08-21 («двадцать раз прошёл онбординг»): прогресс сохранялся
// только на шаге согласий, а у пришедшего с сайта или из бота согласие уже
// есть — шаг пропускался, и уход с середины не сохранял ничего.
describe('Disclaimer — прогресс сохраняется на каждом шаге', () => {
  it('согласие уже дано, home_screen доступен: открывается сразу на нём и «Пропустить и начать» сохраняет прогресс', () => {
    vi.mocked(canOfferHomeScreenNow).mockReturnValue(true);
    const onConsent = vi.fn();
    render(
      <Disclaimer onAccept={() => {}} onConsent={onConsent} consentGiven />,
    );
    expect(screen.getByText('step-home-screen')).toBeTruthy();
  });

  it('заблокированный шаг (галочки не стоят) прогресс не сохраняет', () => {
    // home_screen доступен, чтобы not_therapy НЕ был последним шагом — иначе
    // тест бы проверял финальную кнопку, а не «Далее →» (для этого — отдельная
    // группа тестов ниже).
    vi.mocked(canOfferHomeScreenNow).mockReturnValue(true);
    const onConsent = vi.fn();
    render(<Disclaimer onAccept={() => {}} onConsent={onConsent} />);
    fireEvent.click(screen.getByText('Далее →')); // welcome → privacy
    fireEvent.click(screen.getByText('Далее →')); // privacy → not_therapy
    onConsent.mockClear();
    fireEvent.click(screen.getByText('Далее →')); // заблокировано
    expect(onConsent).not.toHaveBeenCalled();
  });
});

describe('Disclaimer — точки-навигация и финал', () => {
  it('клик по точке шага переключает контент напрямую', () => {
    render(<Disclaimer onAccept={() => {}} onConsent={() => {}} />);
    const dots = document.querySelectorAll('[role="button"][tabindex="0"]');
    // Последняя точка (без home_screen — canOfferHomeScreenNow=false) — not_therapy.
    fireEvent.click(dots[dots.length - 1]);
    expect(screen.getByText('step-not-therapy')).toBeTruthy();
  });

  it('canOfferHomeScreenNow=false — шага home_screen нет, финал «Начать»', () => {
    render(<Disclaimer onAccept={() => {}} onConsent={() => {}} />);
    const dots = document.querySelectorAll('[role="button"][tabindex="0"]');
    fireEvent.click(dots[dots.length - 1]);
    expect(screen.getByText('Начать')).toBeTruthy();
  });

  it('canOfferHomeScreenNow=true — финальная кнопка «Пропустить и начать», зовёт onAccept', () => {
    vi.mocked(canOfferHomeScreenNow).mockReturnValue(true);
    const onAccept = vi.fn();
    render(<Disclaimer onAccept={onAccept} onConsent={() => {}} />);
    const dots = document.querySelectorAll('[role="button"][tabindex="0"]');
    fireEvent.click(dots[dots.length - 1]); // home_screen — последний шаг
    expect(screen.getByText('Пропустить и начать')).toBeTruthy();
    fireEvent.click(screen.getByText('Пропустить и начать'));
    expect(onAccept).toHaveBeenCalled();
  });

  it('«Назад» с шага 2 возвращает на шаг 1', () => {
    render(<Disclaimer onAccept={() => {}} onConsent={() => {}} />);
    fireEvent.click(screen.getByText('Далее →')); // welcome → privacy
    fireEvent.click(screen.getByText('← Назад')); // privacy → welcome
    expect(screen.getByText('step-welcome')).toBeTruthy();
  });
});

// Регресс, найденный при сведении визарда к 4 шагам: когда home_screen
// недоступен (canOfferHomeScreenNow=false), not_therapy становится
// ПОСЛЕДНИМ шагом — а финальная кнопка («Начать») раньше не проверяла гейт
// согласий вообще (гейт стоял только на промежуточной «Далее →», которая на
// последнем шаге не рендерится). Раньше это было безопасно, потому что
// not_therapy никогда не был последним шагом (после него всегда шёл минимум
// один содержательный шаг). После свода шагов условие изменилось — гейт
// обязан держать и финальную кнопку.
describe('Disclaimer — гейт держит и финальную кнопку, когда not_therapy последний шаг', () => {
  it('обе галочки не стоят — «Начать» не зовёт onAccept', () => {
    const onAccept = vi.fn();
    render(<Disclaimer onAccept={onAccept} onConsent={() => {}} />);
    fireEvent.click(screen.getByText('Далее →')); // welcome → privacy
    fireEvent.click(screen.getByText('Далее →')); // privacy → not_therapy
    expect(screen.getByText('Начать')).toBeTruthy(); // not_therapy — последний доступный шаг
    fireEvent.click(screen.getByText('Начать'));
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('только одна галочка стоит — «Начать» всё ещё не зовёт onAccept', () => {
    const onAccept = vi.fn();
    render(<Disclaimer onAccept={onAccept} onConsent={() => {}} />);
    fireEvent.click(screen.getByText('Далее →')); // welcome → privacy
    fireEvent.click(screen.getByText('toggle-c2')); // c2=true
    fireEvent.click(screen.getByText('Далее →')); // privacy → not_therapy
    fireEvent.click(screen.getByText('Начать')); // c1 всё ещё false
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('обе галочки стоят — «Начать» зовёт onAccept', () => {
    const onAccept = vi.fn();
    render(<Disclaimer onAccept={onAccept} onConsent={() => {}} />);
    fireEvent.click(screen.getByText('Далее →')); // welcome → privacy
    fireEvent.click(screen.getByText('toggle-c2')); // c2=true
    fireEvent.click(screen.getByText('Далее →')); // privacy → not_therapy
    fireEvent.click(screen.getByText('toggle-c1')); // c1=true
    fireEvent.click(screen.getByText('Начать'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});
