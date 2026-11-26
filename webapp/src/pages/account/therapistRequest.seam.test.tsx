// @vitest-environment jsdom
// Заявка психолога на двух экранах — /account и лист настроек — через настоящий api-слой
// (тест на шве, №14): оба читают один GET /api/therapy/request из кеша вкладки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TherapistRequestSection } from './TherapistRequestSection';
import { BecomeTherapistSection } from '../../components/settingsSheet/BecomeTherapistSection';
import { fillTherapistRequestForm } from '../../components/settingsSheet/SettingsSheet.test-helpers';
import { setRefreshHandler, setTokenProvider } from '../../apiClient';
import { clearApiCache } from '../../../../shared/src/api/apiCache';
import { THERAPIST_REQUEST_PENDING } from '../../../../shared/src/therapy/therapistRequestCopy';

// Nest на `return null` шлёт пустое тело — так сервер отвечает «заявки нет».
const ok = (body: unknown) => new Response(body === null ? '' : JSON.stringify(body), { status: 200 });

beforeEach(() => {
  clearApiCache();
  setTokenProvider(() => 'tok');
  setRefreshHandler(() => Promise.resolve(false));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('заявка психолога: /account и настройки', () => {
  it('поданная на /account заявка сразу «на рассмотрении» в настройках: POST сбрасывает кеш GET', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok({ ok: true }))
      .mockResolvedValueOnce(ok({ id: 7, status: 'pending', rejectReason: null }));
    vi.stubGlobal('fetch', fetchMock);

    const account = render(<TherapistRequestSection />);
    fireEvent.click(await screen.findByText('Я психолог — подать заявку'));
    fillTherapistRequestForm();
    fireEvent.click(screen.getByText('Отправить заявку'));
    await screen.findByText(THERAPIST_REQUEST_PENDING);
    account.unmount();

    render(<BecomeTherapistSection />);
    await screen.findByText(THERAPIST_REQUEST_PENDING);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toMatch(/\/api\/therapy\/request$/);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('отказ — один текст и один вид (лист FieldError, role=status) на обоих экранах', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ id: 3, status: 'rejected', rejectReason: 'нет диплома.' })));

    const account = render(<TherapistRequestSection />);
    const onAccount = (await screen.findByRole('status')).outerHTML;
    account.unmount();

    render(<BecomeTherapistSection />);
    const inSettings = await screen.findByRole('status');
    expect(inSettings.outerHTML).toBe(onAccount);
    expect(inSettings.textContent?.replace(/\u00a0/g, ' ')).toBe(
      'Прошлая заявка отклонена: нет диплома. Можешь подать новую.',
    );
    expect(inSettings.className).toContain('pa-alert--field');
  });
});
