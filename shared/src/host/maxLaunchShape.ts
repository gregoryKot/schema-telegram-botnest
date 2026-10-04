// Форма стартовых данных MAX: значение WebAppData — строка initData вида
// `query_id=…&user=…&auth_date=…&hash=…` (подписанные пары, один слой
// URL-кодирования уже снят). Голое `#WebAppData=x` формой не обладает.
//
// Зачем (аудит 2026-10, E-5): раньше «нас открыл MAX» значило «во фрагменте
// есть непустой WebAppData». Ссылка `https://schemehappens.ru/app/#WebAppData=x`
// в любом браузере заставляла приложение считать себя MAX, слать
// `x-max-init-data: x` и получать 401 + алерт suspicious_initdata на каждый
// клик. Проверяем форму, а не подстроку: имя ключа — целиком (правило №14),
// значение — непустое. Подпись всё равно проверяет сервер; здесь — только
// отсев очевидно не-MAX запусков. Зеркало — webapp/public/max-bridge.js
// (публичный скрипт, импортировать нельзя), оба под тестами.

/** Есть ли в initData непустые `hash` и `auth_date` (ключи — целиком). */
export function hasMaxInitDataShape(initData: string | undefined): boolean {
  if (!initData) return false;
  const keys = new Set<string>();
  for (const pair of initData.split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0 && pair.length > eq + 1) keys.add(pair.slice(0, eq));
  }
  return keys.has('hash') && keys.has('auth_date');
}
