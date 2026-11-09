// Service worker сайта — только веб-пуши (docs/PWA_PLAN.md, фаза 4, п. 4.6).
// Регистрирует его webapp/src/push/pushSubscription.ts, когда человек включает
// уведомления в «Настройках», — не на каждой загрузке страницы.
//
// Обработчика fetch здесь НЕТ, и это решение, а не пропуск: воркер не
// перехватывает запросы и ничего не кладёт в Cache Storage. Расшифрованные
// дневники, письма и заметки не должны оседать в постоянном хранилище браузера
// (кеш API живёт только в памяти вкладки — shared/src/api/apiCache.ts). Прошлый
// воркер мини-аппа с прекэшем (scope /app/) снят вместе с мини-аппом: адрес
// /app/sw.js отдаёт заглушку, которая чистит кэши (src/unified-frontend.sw-stub.ts).
//
// Тест — webapp/src/push/sw.test.ts: файл из public/ никто не импортирует,
// тест читает его с диска и исполняет с поддельным self (правило №14).

var FALLBACK_TITLE = 'Всё по схеме';
var FALLBACK_PATH = '/today';

// Payload сервера: { title, body, url, tag, silent? }. Битый или пустой —
// уведомление всё равно показывается: push с userVisibleOnly без него браузер
// считает нарушением и может отозвать подписку.
function readPayload(event) {
  try {
    var data = event.data ? event.data.json() : null;
    return data && typeof data === 'object' ? data : {};
  } catch (e) {
    return {};
  }
}

// Переход — только внутри сайта: путь с одним '/', и итоговый адрес того же
// источника (ловит и '//evil.com', и '/\evil.com' — браузер читает '\' как '/').
function targetHref(url) {
  var origin = self.location.origin;
  if (typeof url === 'string' && url.charAt(0) === '/' && url.charAt(1) !== '/') {
    try {
      var parsed = new URL(url, origin);
      if (parsed.origin === origin) return parsed.href;
    } catch (e) {
      // битый путь — на главную кабинета ниже
    }
  }
  return new URL(FALLBACK_PATH, origin).href;
}

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var data = readPayload(event);
  var title = typeof data.title === 'string' && data.title ? data.title : FALLBACK_TITLE;
  var options = {
    icon: '/icon-192.png',
    badge: '/favicon-96.png',
    data: { url: typeof data.url === 'string' ? data.url : FALLBACK_PATH },
    silent: data.silent === true,
  };
  if (typeof data.body === 'string' && data.body) options.body = data.body;
  if (typeof data.tag === 'string' && data.tag) options.tag = data.tag;
  event.waitUntil(self.registration.showNotification(title, options));
});

// Открытое окно сайта — поднять и перевести на нужный раздел; нет окна или
// перевести нельзя (окно не под этим воркером) — открыть новое.
function openOrFocus(href) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
    var client = windows[0];
    if (!client) return self.clients.openWindow(href);
    // focus() без активации пользователя отклоняется — переход всё равно нужен.
    var focusing = client.focus().catch(function () {
      return client;
    });
    return focusing.then(function (focused) {
      var win = focused || client;
      if (typeof win.navigate !== 'function') return win;
      return win.navigate(href).catch(function () {
        return self.clients.openWindow(href);
      });
    });
  });
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var data = event.notification.data || {};
  event.waitUntil(openOrFocus(targetHref(data.url)));
});
