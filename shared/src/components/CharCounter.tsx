import { charCounterState } from '../limits/textLimits';

// Счётчик остатка под полем ввода с пределом длины. Один на оба фронта
// (правило №3 CLAUDE.md): предел сервера — `@MaxLength` в DTO, поле получает
// `maxLength` из `shared/src/limits/textLimits.ts`, а этот блок показывает
// человеку границу ДО отправки. Без него браузер молча перестаёт принимать
// знаки (вставка длинного текста просто обрывается), и непонятно почему.
//
// Пока текста мало, не показывается: цифра «осталось 9 900» — шум. Короткое
// поле (`always`) показывает «N/предел» всегда, как показывала заметка дня.
// Строки безличные — формы «ты/вы» и рода здесь нет.
export function CharCounter({
  length,
  max,
  marginTop = 6,
  always = false,
  id,
}: {
  length: number;
  max: number;
  marginTop?: number;
  /** Показывать «N/предел» с первого знака — для коротких полей. */
  always?: boolean;
  /** id блока — на него ссылается `aria-describedby` поля. */
  id?: string;
}) {
  const state = charCounterState(length, max, always);
  if (!state) return null;
  return (
    <div
      id={id}
      aria-live={state.atLimit ? 'polite' : 'off'}
      style={{
        fontSize: 12,
        textAlign: 'right',
        marginTop,
        marginBottom: 12,
        color: state.atLimit ? 'var(--text)' : 'var(--text-sub)',
        fontWeight: state.atLimit ? 600 : 400,
      }}
    >
      {always
        ? `${length}/${max}`
        : state.atLimit
          ? `Достигнут предел: ${max.toLocaleString('ru-RU')} знаков`
          : `Осталось знаков: ${state.left.toLocaleString('ru-RU')}`}
    </div>
  );
}
