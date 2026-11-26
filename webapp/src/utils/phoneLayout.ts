// «Телефон или нет» для раскладки сайта — единственное место условия.
// CSS-файлы повторяют эти две строки буквально (@media не умеет переменных,
// postcss-custom-media в сборке нет); phoneLayout.test.ts сверяет каждый
// @media в styles/ и index.css с константами ниже.
//
// Телефон: узкий экран ИЛИ палец на низком экране. Телефон в альбомной
// ориентации (844×390, 932×430) шире 768, но высота 390 не вмещает
// десктопную раскладку с неподвижной шапкой: вкладке оставалось 31px.
// Планшет 768×1024 и десктоп с мышью остаются десктопной раскладкой.
export const PHONE_MEDIA = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)';

/** Дополнение PHONE_MEDIA: ширина ≥768 и (высота ≥501 или мышь). */
export const DESKTOP_MEDIA =
  '(min-width: 768px) and (min-height: 501px), (min-width: 768px) and (pointer: fine)';

/** Телефонная раскладка сейчас? Без matchMedia (jsdom, SSR) — по ширине. */
export function isPhoneLayout(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') return window.matchMedia(PHONE_MEDIA).matches;
  return window.innerWidth < 768;
}
