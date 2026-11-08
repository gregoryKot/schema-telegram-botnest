// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://schemehappens.ru/today"}
// .ics шага плана (аудит 2026-11, E6). В Telegram «Добавить в календарь»
// бросал WebAppTgUrlInvalid: openLink клиента пускает только http(s), а файл
// приходил data:-URL. Фейк ниже проверяет протокол так же, как их SDK
// (webapp/public/telegram-web-app.js, WebApp.openLink), — прежний фейк
// принимал что угодно, и тест молчал.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { savePracticeIcs } from './savePracticeIcs';
import { setHost } from '../host';
import { planEventStartMs } from '../utils/planEventStart';

const PARAMS = {
  text: 'Позвонить маме',
  needLabel: 'Привязанность',
  localHour: 19,
  tzOffset: 3,
};

function fakeTelegramSdk() {
  const openLink = vi.fn((url: string) => {
    const a = document.createElement('a');
    a.href = url;
    if (a.protocol !== 'http:' && a.protocol !== 'https:')
      throw Error('WebAppTgUrlInvalid');
  });
  (globalThis as { Telegram?: unknown }).Telegram = {
    WebApp: {
      platform: 'ios',
      initData: 'user=%7B%22id%22%3A1%7D&hash=abc',
      openLink,
    },
  };
  return openLink;
}

afterEach(() => {
  delete (globalThis as { Telegram?: unknown }).Telegram;
  setHost(null);
  vi.restoreAllMocks();
});

describe('savePracticeIcs — Telegram', () => {
  it('в openLink уходит https-ссылка на файл с сервера, а не data:-URL', async () => {
    const openLink = fakeTelegramSdk();
    const link = vi.fn().mockResolvedValue({ path: '/api/plan/ics/TOKEN_1' });
    await savePracticeIcs(PARAMS, link);
    expect(link).toHaveBeenCalledWith({
      text: 'Позвонить маме',
      needLabel: 'Привязанность',
      startMs: planEventStartMs(19, 3),
    });
    expect(openLink).toHaveBeenCalledTimes(1);
    expect(openLink).toHaveBeenCalledWith(
      'https://schemehappens.ru/api/plan/ics/TOKEN_1',
    );
  });

  it('сервер не выдал ссылку — промис отклонён, openLink не зовётся', async () => {
    const openLink = fakeTelegramSdk();
    const link = vi.fn().mockRejectedValue(new Error('503'));
    await expect(savePracticeIcs(PARAMS, link)).rejects.toThrow('503');
    expect(openLink).not.toHaveBeenCalled();
  });
});

describe('savePracticeIcs — браузер', () => {
  it('файл собирается на устройстве и скачивается сразу, сервер не нужен', () => {
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const link = vi.fn();
    void savePracticeIcs(PARAMS, link);
    expect(click).toHaveBeenCalled();
    expect(anchor.getAttribute('href')).toMatch(/^data:text\/calendar/);
    expect(anchor.getAttribute('download')).toBe('practice.ics');
    expect(link).not.toHaveBeenCalled();
  });
});
