// Эвристика «во фразе есть обращение на ты/вы». Канал «Здорового Взрослого» —
// broadcast, не привязан к addressForm, поэтому его фразы должны быть безличными.
// Используется в админке как мягкое предупреждение (не блокирует сохранение).
// Токенизируем по unicode-буквам (JS \w/\b — ASCII, на кириллице не работают).
const SECOND_PERSON_WORDS = new Set([
  'ты', 'тебя', 'тебе', 'тобой', 'твой', 'твоя', 'твоё', 'твоего', 'твои',
  'вы', 'вас', 'вам', 'вами', 'ваш', 'ваша', 'ваше', 'ваши', 'вашего',
]);
const SECOND_PERSON_ENDING = /(ешь|аешь|ишь|ете|йте)$/;

export function hasSecondPerson(text: string): boolean {
  return text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .some(
      (w) => SECOND_PERSON_WORDS.has(w) || SECOND_PERSON_ENDING.test(w),
    );
}
