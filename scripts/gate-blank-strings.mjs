// Стирание текста строковых литералов JS/TS для гейтов, которые ищут в коде
// вызов по имени. Первый потребитель — persistent-throttle-parse.mjs: тело
// хендлера читалось вместе со строками, и `verifyCode(` в тексте ошибки сошёл
// бы за проверку кода (находка docs/open/backend.md). Отдельный модуль, а не
// кусок парсера: тот уже в храповике размера (правило №10), а приём общий.
// Комментарии стирает вызывающий (здесь `//` внутри строки — просто текст).
// Тест — src/test-support/gates/persistent-throttle.spec.ts.

/**
 * Код без текста строковых литералов: кавычки, длина и переводы строк
 * остаются (номера строк не съезжают); код внутри `${…}` шаблонной строки
 * остаётся кодом, включая вложенные шаблоны и объектные литералы.
 */
export function blankStrings(src) {
  let out = '';
  const stack = []; // '`' — текст шаблона, '${' и '{' — код внутри шаблона
  for (let i = 0; i < src.length; ) {
    const c = src[i];
    if (stack[stack.length - 1] === '`') {
      if (c === '\\') {
        out += src[i + 1] === undefined ? ' ' : '  ';
        i += 2;
        continue;
      }
      if (c === '$' && src[i + 1] === '{') {
        stack.push('${');
        out += '${';
        i += 2;
        continue;
      }
      if (c === '`') stack.pop();
      out += c === '`' || c === '\n' ? c : ' ';
      i += 1;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') {
        j += src[j] === '\\' ? 2 : 1;
      }
      j = Math.min(j, src.length);
      out += c + ' '.repeat(j - i - 1);
      if (src[j] === c) {
        out += c;
        j += 1;
      }
      i = j;
    } else {
      if (c === '`') stack.push('`');
      else if (c === '{') stack.push('{');
      else if (c === '}') stack.pop();
      out += c;
      i += 1;
    }
  }
  return out;
}
