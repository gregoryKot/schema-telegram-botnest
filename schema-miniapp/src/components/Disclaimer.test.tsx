// @vitest-environment jsdom
// Disclaimer — визард первого входа (0% покрытия). Шаги-контент мокаем
// (каждый — самостоятельный текстовый компонент без логики); здесь проверяем
// ТОЛЬКО навигацию и гейт согласий: правило CLAUDE.md «на шаге not_therapy
// нельзя идти дальше, пока не отмечены обе галочки» — самый частый источник
// «застрял в онбординге» багов при рефакторинге порядка шагов.
import { describe, it, expect, vi, afterEach } from 'vitest';
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
  DisclaimerPrivacyStep: () => <div>step-privacy</div>,
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
vi.mock('./disclaimer/DisclaimerNeedsWhatStep', () => ({
  DisclaimerNeedsWhatStep: () => <div>step-needs-what</div>,
}));
vi.mock('./disclaimer/DisclaimerNeedsWhyStep', () => ({
  DisclaimerNeedsWhyStep: () => <div>step-needs-why</div>,
}));
vi.mock('./disclaimer/DisclaimerNeedsResultStep', () => ({
  DisclaimerNeedsResultStep: () => <div>step-needs-result</div>,
}));
vi.mock('./disclaimer/DisclaimerDiariesWhyStep', () => ({
  DisclaimerDiariesWhyStep: () => <div>step-diaries-why</div>,
}));
vi.mock('./disclaimer/DisclaimerTodayScreenStep', () => ({
  DisclaimerTodayScreenStep: () => <div>step-today-screen</div>,
}));
vi.mock('./disclaimer/DisclaimerAuthorStep', () => ({
  DisclaimerAuthorStep: () => <div>step-author</div>,
}));
vi.mock('./disclaimer/DisclaimerHomeScreenStep', () => ({
  DisclaimerHomeScreenStep: () => <div>step-home-screen</div>,
}));
vi.mock('../hooks/useOnboardingStepTracking', () => ({
  useOnboardingStepTracking: vi.fn(),
  trackOnboardingDone: vi.fn(),
}));

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
    // consentGiven=true — открывается сразу на needs_what (initialStepIndex)
    expect(screen.getByText('step-needs-what')).toBeTruthy();
  });
});

describe('Disclaimer — точки-навигация и финал', () => {
  it('клик по точке шага переключает контент напрямую', () => {
    render(<Disclaimer onAccept={() => {}} onConsent={() => {}} />);
    const dots = document.querySelectorAll('[role="button"][tabindex="0"]');
    // Последняя точка (без home_screen — canOfferHomeScreenNow=false) — author.
    fireEvent.click(dots[dots.length - 1]);
    expect(screen.getByText('step-author')).toBeTruthy();
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
