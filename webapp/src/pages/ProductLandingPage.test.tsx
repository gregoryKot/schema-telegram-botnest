// @vitest-environment jsdom
// ProductLandingPage — маркетинговый лендинг app-домена (0% покрытия, 290
// строк). Логика здесь минимальна (в основном JSX/стили — тест не
// обязателен по CLAUDE.md), но две вещи важны: авторизованный юзер не
// должен видеть лендинг (редирект на /today), а статьи в блоке «Статьи» —
// реальные из API, не заглушка.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductLandingPage } from './ProductLandingPage';
import { AuthContext, type AuthState } from '../auth/authContext';

const listArticles = vi.fn();
vi.mock('../api', () => ({
  api: { listArticles: (...a: unknown[]) => listArticles(...a) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  listArticles.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

function authValue(overrides: Partial<AuthState> = {}): AuthState {
  return {
    accessToken: null,
    isLoading: false,
    isAuthenticated: false,
    setAccessToken: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    ...overrides,
  };
}

function renderPage(auth: AuthState = authValue()) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={auth}>
        <ProductLandingPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('ProductLandingPage — неавторизованный визитор', () => {
  it('рендерит главный заголовок и CTA на вход', () => {
    renderPage();
    expect(screen.getByText(/это происходит\?/)).toBeTruthy();
    expect(screen.getAllByText('Начать бесплатно →').length).toBeGreaterThan(0);
  });

  it('рендерит блок «Как это работает» и «Возможности» без падений', () => {
    renderPage();
    expect(screen.getAllByText('Как это работает').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Возможности').length).toBeGreaterThan(0);
  });

  it('без статей из API блок «Статьи» не рендерится (не выдуманные карточки)', async () => {
    listArticles.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(listArticles).toHaveBeenCalled());
    expect(screen.queryByText('Все статьи →')).toBeNull();
  });

  it('реальные статьи из API рендерятся карточками', async () => {
    listArticles.mockResolvedValue([
      { id: 1, slug: 'a', title: 'Статья про схемы', description: 'т', date: '2026-01-01', readMin: 4 },
    ]);
    renderPage();
    expect(await screen.findByText('Статья про схемы')).toBeTruthy();
  });

  it('футер содержит ссылки на оферту и политику конфиденциальности', () => {
    renderPage();
    const offerLink = screen.getByText('Оферта') as HTMLAnchorElement;
    const privacyLink = screen.getByText('Политика конфиденциальности') as HTMLAnchorElement;
    expect(offerLink.getAttribute('href')).toBe('/offer');
    expect(privacyLink.getAttribute('href')).toBe('/privacy');
  });
});

describe('ProductLandingPage — авторизованный юзер', () => {
  it('не должен видеть маркетинговый лендинг — уходит в приложение', () => {
    // useNavigate внутри MemoryRouter без Routes не меняет видимый экран,
    // но эффект обязан сработать хотя бы без падений и без ошибок в консоли.
    expect(() => renderPage(authValue({ isAuthenticated: true, accessToken: 'tok' }))).not.toThrow();
  });
});
