// Подпись устройства для сверки: «iPhone · Safari».
//
// Нужна ровно одному экрану — карточке подтверждения входа в боте. Человек
// должен видеть, ЧТО просит доступ: подтверждение вслепую («какой-то вход,
// нажми ок») защищает не больше, чем его отсутствие.
//
// Почему не берём `webPlatform` из shared/src/host/web.ts: бэкенд из shared
// не импортирует (тот же приём, что у quiz-logic.ts и telemetry-url.util.ts),
// и задача другая — там нужен идентификатор площадки для capabilities, здесь
// человекочитаемая строка с браузером. Пересекается только регуляркой на iOS.
//
// Из User-Agent берём ТОЛЬКО класс устройства и браузер. Версии, сборки и
// прочее, по чему человека можно узнать среди других, не сохраняем: строка
// уезжает в БД и показывается в чате.

const DEVICES: Array<[RegExp, string]> = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Windows/, 'Windows'],
  [/Linux/, 'Linux'],
];

// Порядок важен: Edge и Opera представляются ещё и Chrome, Chrome — ещё и
// Safari. Проверяем от частного к общему, иначе всё станет «Chrome».
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/YaBrowser/, 'Яндекс.Браузер'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

function match(ua: string, table: Array<[RegExp, string]>): string | null {
  for (const [re, name] of table) if (re.test(ua)) return name;
  return null;
}

/**
 * Человекочитаемая подпись устройства. Пустой или неузнанный User-Agent даёт
 * `''` — карточка подтверждения тогда просто не покажет строку устройства,
 * а не соврёт «Windows · Chrome» наугад.
 */
export function deviceLabel(userAgent: string | undefined): string {
  const ua = (userAgent ?? '').slice(0, 400);
  if (!ua) return '';
  const parts = [match(ua, DEVICES), match(ua, BROWSERS)].filter(
    (p): p is string => p !== null,
  );
  return parts.join(' · ');
}
