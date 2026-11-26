// Файл сборки не дошёл — запросить его снова, а не оставить страницу без стилей
// или пустой. Инцидент 2026-11-04: сразу после выкладки HTML /donate пришёл, а
// /assets/index-<хеш>.css получил вместо стиля HTML (техработы, 503 платформы
// или SPA-фолбэк сборки без этого файла); повтора не было, стилей тоже.
// Ленивые разделы лечит webapp/src/utils/chunkReload.ts, а входные теги Vite
// (конец <head>) код бандла не спасёт: при их сбое бандла ещё нет.
//
// Подключается синхронно сразу за theme.js, раньше тегов сборки (инлайн нельзя:
// CSP без 'unsafe-inline'). error у <link>/<script> не всплывает — слушаем
// window в фазе перехвата; link.sheet у упавшего стиля в Chromium не null.
//   • стиль — новый <link> с ?retry=N сразу за упавшим (каскад тот же, кэш мимо),
//     паузы 1/2/4/8/16/32/64 с: всего ~2 мин, больше окна выкладки на Amvera
//     (замеры 2026-11-05: 50–60 с техработ и 503 платформы). Без перезагрузки: JS
//     уже мог начать разовое действие (возврат с оплаты, вход через OAuth),
//     повтор хуже страницы без стилей.
//   • модуль — приложение не стартовало: перезагрузка, не больше трёх за
//     2 минуты (паузы 1/4/15 с), метки — в sessionStorage.
// Не помогло — отчёт в /api/client-errors, секция 'assets' (свой бакет в
// src/api/client-error-section.ts и своя строка «Файлы сайта не загрузились»
// в блоке «Поломки на клиенте» отчёта /stats). Помогло — анонимное событие
// asset_recovered в /api/public-event (kind css|js, attempts — с какой попытки;
// src/analytics/asset-recovery.constants.ts), строка «повтор помог» там же.
// Тест: webapp/src/assetRecovery.test.ts; в браузере — e2e-browser/asset-recovery.spec.ts.
(function () {
  var CSS_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 32000, 64000];
  var RELOAD_DELAYS_MS = [1000, 4000, 15000];
  var RELOAD_WINDOW_MS = 120000;
  var RELOAD_KEY = 'asset-reload-at';
  var RECOVERED_KEY = 'asset-recovered-for';
  var OWN_ASSET = /^\/(game\/)?assets\//;
  var reported = {};
  var moduleFailed = false;

  // Путь файла сборки этого сайта; null — чужой хост, другой каталог, битый адрес.
  function assetPath(url) {
    try {
      var u = new URL(url, location.href);
      if (u.origin === location.origin && OWN_ASSET.test(u.pathname))
        return u.pathname;
    } catch (e) {
      // Битый адрес — не наш файл.
    }
    return null;
  }

  function post(url, body) {
    try {
      fetch(url, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(function () {});
    } catch (e) {
      // Отчёт не роняет страницу.
    }
  }

  // Один отчёт на файл за страницу. В url только путь: во фрагменте бывает
  // токен входа (H0, shared/src/api/clientErrorReport.ts).
  function report(kind, path) {
    if (reported[path]) return;
    reported[path] = true;
    post('/api/client-errors', {
      source: 'webapp',
      section: 'assets',
      message: 'Файл сборки не загрузился: ' + kind + ' ' + path,
      url: location.pathname,
    });
  }

  // Повтор помог: без сигнала видны только неудачи, а сколько выкладок задело
  // людей без последствий — нет. Без пути и адреса: только вид и попытка.
  function recovered(kind, attempts) {
    post('/api/public-event', {
      name: 'asset_recovered',
      meta: { kind: kind, attempts: attempts },
    });
  }

  function retryStylesheet(link, path) {
    var attempt = Number(link.getAttribute('data-asset-retry')) || 0;
    if (attempt >= CSS_RETRY_DELAYS_MS.length) return report('CSS', path);
    setTimeout(function () {
      if (!link.parentNode) return;
      var next = document.createElement('link');
      next.rel = 'stylesheet';
      var cors = link.getAttribute('crossorigin');
      if (cors !== null) next.setAttribute('crossorigin', cors);
      next.href = path + '?retry=' + (attempt + 1);
      next.setAttribute('data-asset-retry', String(attempt + 1));
      next.addEventListener('load', function () {
        recovered('css', attempt + 1);
      });
      link.parentNode.insertBefore(next, link.nextSibling);
    }, CSS_RETRY_DELAYS_MS[attempt]);
  }

  // Метки перезагрузок моложе окна; null — sessionStorage бросает или хранит
  // не массив чисел.
  function recentReloads(now) {
    try {
      var list = JSON.parse(sessionStorage.getItem(RELOAD_KEY) || '[]');
      if (!Array.isArray(list)) return null;
      var recent = [];
      for (var i = 0; i < list.length; i++) {
        if (typeof list[i] !== 'number') return null;
        if (now - list[i] <= RELOAD_WINDOW_MS) recent.push(list[i]);
      }
      return recent;
    } catch (e) {
      return null;
    }
  }

  // Без памяти о прошлых перезагрузках не перезагружаем: цикл не остановить.
  function reloadForModule(path) {
    var now = Date.now();
    var recent = recentReloads(now);
    if (recent && recent.length < RELOAD_DELAYS_MS.length) {
      recent.push(now);
      try {
        sessionStorage.setItem(RELOAD_KEY, JSON.stringify(recent));
        var delay = RELOAD_DELAYS_MS[recent.length - 1];
        return setTimeout(function () {
          location.reload();
        }, delay);
      } catch (e) {
        // Метку не записать — дальше отчёт без перезагрузки.
      }
    }
    report('JS', path);
  }

  // У ошибки кода target — window, nodeName у него нет. Упавший modulepreload
  // не трогаем: его сбой и так роняет входной модуль.
  function onError(event) {
    var el = event.target;
    var tag = el && el.nodeName;
    if (tag === 'LINK' && /(^|\s)stylesheet(\s|$)/i.test(el.rel)) {
      var cssPath = assetPath(el.href);
      if (cssPath) retryStylesheet(el, cssPath);
    } else if (tag === 'SCRIPT' && /^module$/i.test(el.type)) {
      var jsPath = assetPath(el.src);
      if (jsPath) {
        moduleFailed = true;
        reloadForModule(jsPath);
      }
    }
  }

  // Страница догрузилась без сбоя модуля, а свежие метки перезагрузок есть —
  // перезагрузка помогла. Один сигнал на серию: метка последней перезагрузки
  // запоминается; без памяти не шлём, иначе сигнал на каждой загрузке.
  function onLoad() {
    var recent = moduleFailed ? null : recentReloads(Date.now());
    if (!recent || recent.length === 0) return;
    var last = String(recent[recent.length - 1]);
    try {
      if (sessionStorage.getItem(RECOVERED_KEY) === last) return;
      sessionStorage.setItem(RECOVERED_KEY, last);
    } catch (e) {
      return;
    }
    recovered('js', recent.length);
  }

  window.addEventListener('error', onError, true);
  window.addEventListener('load', onLoad);
})();
