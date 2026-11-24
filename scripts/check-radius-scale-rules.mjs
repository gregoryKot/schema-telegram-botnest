// Правила гейта check-radius-scale.mjs (решение 3 в #1619): что считать чипом
// и что пока вне шкалы — с причиной у каждой строки.

// Файлы вне шкалы до своего PR: [причина, путь].
export const EXEMPT = [
  [
    'визитка и запись/оплата — до PR визитки (#1639)',
    /^webapp\/src\/(pages\/landing\/|pages\/LandingPage\.tsx$|pages\/BookingPaidPage\.tsx$|components\/landing-kit|components\/booking\/|components\/BookingPicker\.tsx$|styles\/product-(landing|tests)[\w-]*\.css$|styles\/auth-pay\.css$)/,
  ],
  ['админка вне охвата редизайна (#1619, решение 6)', /^webapp\/src\/pages\/(AdminPage\.tsx$|admin\/)/],
];

// Селекторы вне шкалы до своего PR.
export const EXEMPT_SELECTORS = new Set([
  '.ds-seg', // cabinet.css: серая капсула-сегмент удаляется целиком в Г1в (#1619)
]);

// Капсула — только у чипов: селектор правила называет чип, пилюлю или метку.
export const CHIP_SELECTOR = /chip|(?<!search-)pill|[-.]tags?\b/i;
// Чипы с другим именем класса.
export const CHIP_ALLOW = new Set([
  '.cd-tracker', // client-diary.css: индекс трекера дня — чип, а не карточка
  '.mm2-n--need > .mm2-n-face', // modemap-paper.css: капсула отличает потребность от режима на карте
]);

// Инлайн-капсула: где форма — сама суть (класс-чип в стиле объекта не назвать).
export const INLINE_PILL_ALLOW = new Set([
  'webapp/src/components/modeMap/ShapePicker.tsx', // образец формы «капсула» узла карты
  'shared/src/therapy/conceptGraph/conceptChipStyle.ts', // пилюля-переключатель концепта
]);

export const MAX_PX = 16;
