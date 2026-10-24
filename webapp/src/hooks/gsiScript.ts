// Загрузчик скрипта Google Identity Services (One Tap).
//
// Раньше тег `<script src="https://accounts.google.com/gsi/client">` стоял в
// index.html и грузился на КАЖДОЙ странице сайта и визитки kotlarewski.gr —
// хотя политика конфиденциальности (webapp/src/pages/privacy/processors.ts)
// описывает обращение к Google только на странице входа. Теперь скрипт грузит
// хук useGoogleOneTap, и только когда окно включено и задан client id: на
// остальных страницах браузер к Google не ходит.

const SCRIPT_ID = 'gsi-client';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

// Одна попытка на всех: параллельные вызовы получают тот же промис и не плодят
// теги. После сбоя кэш сбрасывается — следующий вызов пробует заново.
let pending: Promise<boolean> | null = null;

const gsiReady = (): boolean => Boolean(window.google?.accounts?.id);

/**
 * `true` — скрипт Google загружен и `window.google.accounts.id` доступен;
 * `false` — не загрузился (сеть, блокировщик, CSP). Не бросает: One Tap
 * необязателен, у человека остаются обычные кнопки входа.
 */
export function loadGsiScript(): Promise<boolean> {
  if (gsiReady()) return Promise.resolve(true);
  if (pending) return pending;

  // Тег от прошлой попытки (после `error`) повторно не сработает — убираем.
  document.getElementById(SCRIPT_ID)?.remove();

  const attempt = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve(true));
    script.addEventListener('error', () => {
      pending = null;
      script.remove();
      resolve(false);
    });
    document.head.appendChild(script);
  });
  pending = attempt;
  return attempt;
}
