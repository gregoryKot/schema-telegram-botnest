// Маска: наружу отдаём тип и размер, но не содержимое.
function mask(v) {
  if (v === null) return 'null';
  if (v === undefined) return '—';
  var t = typeof v;
  if (t === 'string') return 'строка(' + v.length + ')';
  if (t === 'number' || t === 'boolean') return t + '=' + v;
  if (t === 'function') return 'функция';
  if (Array.isArray(v)) return 'массив(' + v.length + ')';
  return 'объект{' + Object.keys(v).join(', ') + '}';
}

// Плоский список полей объекта: имя → чем оно является.
function shape(obj, depth) {
  if (!obj || typeof obj !== 'object') return mask(obj);
  var lines = [];
  Object.keys(obj).forEach(function (k) {
    var v = obj[k];
    lines.push('  '.repeat(depth) + k + ': ' + mask(v));
    if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) {
      lines.push(shape(v, depth + 1));
    }
  });
  return lines.join('\n');
}

// Строка-подпись (initData) приходит query-строкой или JSON — важно, чем
// именно, и какие в ней поля. Значения по-прежнему не показываем.
function shapeSigned(raw) {
  if (typeof raw !== 'string' || !raw) return '—';
  var out = ['длина ' + raw.length];
  try {
    var asJson = JSON.parse(raw);
    out.push('формат: JSON');
    out.push(shape(asJson, 1));
    return out.join('\n');
  } catch (e) {
    /* не JSON — пробуем query-строку */
  }
  var p = new URLSearchParams(raw);
  var keys = [];
  p.forEach(function (v, k) {
    keys.push('  ' + k + ': строка(' + v.length + ')');
    if (v.charAt(0) === '{') {
      try {
        keys.push(shape(JSON.parse(v), 2));
      } catch (e) {
        /* вложенного JSON нет */
      }
    }
  });
  out.push('формат: ' + (keys.length ? 'query-строка' : 'непонятный'));
  if (keys.length) out.push(keys.join('\n'));
  return out.join('\n');
}

// Глобальные объекты, за которыми площадки прячут свой мост.
var CANDIDATES = ['WebApp', 'Telegram', 'MAX', 'max', 'maxBridge', 'Bridge', 'webApp'];

function report() {
  var blocks = [];

  var found = CANDIDATES.filter(function (n) {
    return typeof window[n] !== 'undefined';
  });
  blocks.push([
    'Мост площадки',
    found.length
      ? found
          .map(function (n) {
            return n + ':\n' + shape(window[n], 1);
          })
          .join('\n\n')
      : 'НИ ОДНОГО из: ' + CANDIDATES.join(', ') +
        '\n(значит, нужна их js-библиотека — пришли ссылку на неё из доков)',
  ]);

  // Кандидат на объект приложения: WebApp сам или Telegram.WebApp.
  var app = window.WebApp || (window.Telegram && window.Telegram.WebApp);
  if (app) {
    blocks.push(['Поля объекта приложения', shape(app, 0)]);
    blocks.push([
      'Подпись входа (initData)',
      shapeSigned(app.initData || app.init_data),
    ]);
    blocks.push([
      'Умеет ли',
      [
        ['ready', app.ready],
        ['expand', app.expand],
        ['close', app.close],
        ['openLink', app.openLink],
        ['BackButton', app.BackButton],
        ['HapticFeedback', app.HapticFeedback],
        ['addToHomeScreen', app.addToHomeScreen],
        ['onEvent', app.onEvent],
        ['themeParams', app.themeParams],
        ['safeAreaInset', app.safeAreaInset],
      ]
        .map(function (pair) {
          var has = !!pair[1];
          return (has ? '✓ ' : '✗ ') + pair[0];
        })
        .join('\n'),
    ]);
  }

  blocks.push([
    'Адрес страницы',
    'search: ' + shapeSigned(location.search.replace(/^\?/, '')) +
      '\nhash: ' + shapeSigned(location.hash.replace(/^#/, '')),
  ]);

  blocks.push([
    'Вебвью',
    'userAgent: ' + navigator.userAgent +
      '\nreferrer: ' + (document.referrer || '—') +
      '\nэкран: ' + window.innerWidth + '×' + window.innerHeight +
      '\ntheme: ' +
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') +
      '\nвибрация: ' + (typeof navigator.vibrate === 'function' ? 'есть' : 'нет'),
  ]);

  return blocks;
}

function render() {
  var blocks = report();
  document.getElementById('out').innerHTML = blocks
    .map(function (b) {
      var body = String(b[1])
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/✓/g, '<span class="ok">✓</span>')
        .replace(/✗/g, '<span class="no">✗</span>');
      return '<section><h2>' + b[0] + '</h2><pre>' + body + '</pre></section>';
    })
    .join('');
  window.__dump = blocks
    .map(function (b) {
      return '## ' + b[0] + '\n' + b[1];
    })
    .join('\n\n');
}

// Мост может дозаполниться после загрузки — перечитываем.
render();
setTimeout(render, 300);
setTimeout(render, 1500);

// Копирование в вебвью мессенджера часто запрещено, поэтому кнопка всегда
// показывает отчёт текстом в поле — оттуда его можно выделить руками.
document.getElementById('copy').addEventListener('click', function () {
  var btn = this;
  var ta = document.getElementById('dump');
  ta.value = window.__dump;
  ta.style.display = 'block';
  ta.focus();
  ta.select();

  var ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  if (!ok && navigator.clipboard) {
    navigator.clipboard.writeText(window.__dump).then(
      function () {
        btn.textContent = 'Скопировано';
      },
      function () {},
    );
  }
  btn.textContent = ok ? 'Скопировано' : 'Отчёт ниже — выдели и скопируй';
});
