// Платформы запуска в блоке «Вход в мессенджере» (аудит 2026-10): пустая БД,
// подписи без внутренних id, сигнал «входить отсюда перестали».
import {
  formatLaunchPlatforms,
  LAUNCH_PLATFORM_LABELS,
} from './launch-platform-metrics.format';
import { LAUNCH_PLATFORMS } from '../analytics/launch-platforms.constants';

describe('formatLaunchPlatforms', () => {
  it('пустая БД — одна понятная строка, без нулей и NaN', () => {
    const text = formatLaunchPlatforms([]);
    expect(text).toContain('пока нет');
    expect(text).not.toMatch(/NaN|undefined|\b0\b/);
  });

  it('строки только с нулями считаются пустыми', () => {
    expect(
      formatLaunchPlatforms([
        { host: 'telegram', platform: 'ios', week: 0, prevWeek: 0 },
      ]),
    ).toContain('пока нет');
  });

  it('платформы — словами, по убыванию запусков, с прошлой неделей в скобках', () => {
    const text = formatLaunchPlatforms([
      { host: 'max', platform: 'desktop', week: 2, prevWeek: 1 },
      { host: 'telegram', platform: 'ios', week: 34, prevWeek: 40 },
    ]);
    const lines = text.split('\n');
    expect(lines[1]).toBe('Telegram · iPhone и iPad — 34 (40)');
    expect(lines[2]).toBe('MAX · компьютер — 2 (1)');
    expect(text).not.toMatch(/\bios\b|desktop|telegram/);
  });

  it('платформа, с которой перестали входить, помечена', () => {
    const text = formatLaunchPlatforms([
      { host: 'telegram', platform: 'webk', week: 0, prevWeek: 12 },
      { host: 'telegram', platform: 'android', week: 0, prevWeek: 2 },
    ]);
    expect(text).toContain(
      'Telegram · браузер, Web K — 0 (12) — входить отсюда перестали',
    );
    // Два запуска в неделю пропадают и сами — это не сигнал.
    expect(text).toMatch(/^Telegram · Android — 0 \(2\)$/m);
  });

  it('у каждой платформы реестра есть подпись', () => {
    for (const id of LAUNCH_PLATFORMS) {
      expect(LAUNCH_PLATFORM_LABELS[id]).toBeTruthy();
    }
  });
});
