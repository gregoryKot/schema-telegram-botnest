// Загрузчик моста MAX (`public/max-bridge.js`) — единственный код страницы,
// который решает, появится ли в окне глобаль window.WebApp. Ошибка в его
// условии стоила инцидента 2026-08-08: он искал ПОДСТРОКУ `WebAppData=`, а
// Telegram передаёт свои стартовые данные тем же фрагментом — `#tgWebAppData=…`.
// Мост MAX грузился у каждого пользователя Telegram, приложение считало себя
// открытым в MAX, отправляло пустую MAX-подпись и показывало «Не удалось войти».
//
// Файл лежит в public/ — его никто не импортирует, поэтому тест читает его с
// диска и исполняет с поддельными window/document, как это делает браузер.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(
  resolve(__dirname, '../public/max-bridge.js'),
  'utf8',
);

/** Прогон загрузчика с заданным фрагментом адреса. Возвращает написанное в документ. */
function runLoader(hash: string): string[] {
  const written: string[] = [];
  const window = { location: { hash } };
  const document = { write: (html: string) => written.push(html) };
  new Function('window', 'document', SOURCE)(window, document);
  return written;
}

describe('загрузчик моста MAX', () => {
  it('стартовые параметры MAX в адресе — мост подключается', () => {
    const written = runLoader(
      '#WebAppData=auth_date%3D1%26hash%3Dabc&WebAppPlatform=ios',
    );
    expect(written).toHaveLength(1);
    expect(written[0]).toContain('https://st.max.ru/js/max-web-app.js');
  });

  it('параметр не первый во фрагменте — тоже подключается', () => {
    expect(runLoader('#WebAppPlatform=ios&WebAppData=hash%3Dabc')).toHaveLength(
      1,
    );
  });

  // Ядро регресса: телеграмный запуск.
  it('телеграмный tgWebAppData — мост НЕ подключается', () => {
    expect(
      runLoader(
        '#tgWebAppData=user%3D%257B%2522id%2522%253A1%257D%26hash%3Dabc&tgWebAppVersion=8.0&tgWebAppPlatform=ios',
      ),
    ).toEqual([]);
  });

  it('чужой параметр, оканчивающийся на WebAppData — не подключается', () => {
    expect(runLoader('#someWebAppData=1')).toEqual([]);
  });

  it('обычная вкладка без фрагмента — не подключается', () => {
    expect(runLoader('')).toEqual([]);
    expect(runLoader('#/today')).toEqual([]);
  });

  // Страница делит область имён с самим мостом MAX и телеграмным SDK —
  // объявления загрузчика обязаны жить внутри IIFE.
  it('весь код обёрнут в IIFE — глобалей не оставляет', () => {
    expect(SOURCE.replace(/^(\s*\/\/.*\n|\s*\n)+/, '')).toMatch(
      /^\(function \(\) \{/,
    );
  });
});
