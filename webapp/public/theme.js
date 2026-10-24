// Тема до первой отрисовки (localStorage → data-theme), чтобы не мигать белым.
// Раньше жил инлайн-<script> в index.html, но CSP (src/main.ts, scriptSrc без
// 'unsafe-inline') инлайн не исполняет — защита от белой вспышки не работала.
// Подключается синхронно из <head> (`<script src="/theme.js">`, без async/defer),
// поэтому выполняется до первого кадра. Тест: webapp/src/themeScript.test.ts.
// Новую логику сюда не добавлять: файл грузится на критическом пути.
(function () {
  var t = null;
  try {
    // Приватный режим / заблокированные данные сайта: доступ может бросить.
    t = localStorage.getItem('app_theme');
  } catch (e) {
    t = null;
  }
  var root = document.documentElement;
  if (t === 'dark') root.setAttribute('data-theme', 'dark');
  root.style.background = t === 'dark' ? '#14141a' : '#f5f2eb';
  root.style.colorScheme = t === 'dark' ? 'dark' : 'light';
})();
