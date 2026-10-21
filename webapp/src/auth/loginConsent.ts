// Экран входа сайта показывает текст согласия («Нажимая „Войти“…»). Кто его
// видел, тот согласился осознанно, и экран согласий в кабинете ему не нужен.
// Кто вошёл автоматически по подписи Telegram/MAX, экрана входа не видел.
// Флаг живёт в localStorage этого браузера; без него (приватное окно, запрет
// хранилища) безопаснее показать экран, чем принять согласие молча. Память
// страницы закрывает только вход без перезагрузки.
const KEY = 'login_consent_shown';
let shownInMemory = false;

export function markLoginConsentShown(): void {
  shownInMemory = true;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    shownInMemory = true;
  }
}

export function wasLoginConsentShown(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return shownInMemory;
  }
}
