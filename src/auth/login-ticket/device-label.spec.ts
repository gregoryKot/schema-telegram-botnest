import { deviceLabel } from './device-label';

describe('deviceLabel', () => {
  it('iPhone в Safari — самый частый вход с ярлыка', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('iPhone · Safari');
  });

  it('Android в Chrome', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Android · Chrome');
  });

  it('Edge не выдаёт себя за Chrome, хотя называется им', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
      ),
    ).toBe('Windows · Edge');
  });

  it('Chrome не выдаёт себя за Safari', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ),
    ).toBe('Mac · Chrome');
  });

  it('Android приоритетнее Linux, хотя в строке есть оба', () => {
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) Firefox/126.0')).toBe(
      'Android · Firefox',
    );
  });

  it('неузнанный агент не выдумывает устройство', () => {
    expect(deviceLabel('curl/8.4.0')).toBe('');
  });

  it('пустой и отсутствующий агент — пустая строка, а не «undefined»', () => {
    expect(deviceLabel('')).toBe('');
    expect(deviceLabel(undefined)).toBe('');
  });

  it('версии и сборки в подпись не попадают — строка уходит в чат', () => {
    const label = deviceLabel(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Safari/604.1',
    );
    expect(label).not.toMatch(/\d/);
  });

  it('обрезает непомерно длинный агент, а не тащит его целиком', () => {
    expect(deviceLabel('iPhone' + 'x'.repeat(10_000))).toBe('iPhone');
  });
});
