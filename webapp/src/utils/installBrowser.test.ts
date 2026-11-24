import { describe, it, expect } from 'vitest';
import { detectInstallBrowser } from './installBrowser';

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('detectInstallBrowser', () => {
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
  const AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko)';

  it('iPhone: Safari и Chrome (CriOS) различаются', () => {
    expect(detectInstallBrowser(`${IOS} Version/18.0 Mobile/15E148 Safari/604.1`, 5)).toBe('ios-safari');
    expect(detectInstallBrowser(`${IOS} CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1`, 5)).toBe('ios-chrome');
  });

  it('Android: Chrome и Яндекс Браузер различаются', () => {
    expect(detectInstallBrowser(`${AND} Chrome/130.0.0.0 Mobile Safari/537.36`, 5)).toBe('android-chrome');
    expect(detectInstallBrowser(`${AND} Chrome/128.0.0.0 YaBrowser/24.10.3.75.00 SA/3 Mobile Safari/537.36`, 5)).toBe('android-yandex');
  });

  it('незнакомый браузер получает главный для своей системы', () => {
    // Яндекс Браузер на iPhone ставит значок через системный лист — как Safari.
    expect(detectInstallBrowser(`${IOS} YaBrowser/24.10.3.75 Mobile/15E148 Safari/604.1`, 5)).toBe('ios-safari');
    expect(detectInstallBrowser(`${IOS} FxiOS/131.0 Mobile/15E148 Safari/605.1.15`, 5)).toBe('ios-safari');
    expect(detectInstallBrowser(`${AND} SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36`, 5)).toBe('android-chrome');
  });

  it('компьютер — ролика нет', () => {
    expect(detectInstallBrowser(WIN_UA, 0)).toBeNull();
    expect(detectInstallBrowser(MAC_UA, 0)).toBeNull();
  });
});
