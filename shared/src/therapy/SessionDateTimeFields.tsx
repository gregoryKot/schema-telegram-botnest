import type { CSSProperties, Ref } from 'react';
import { joinSession, splitSession } from './sessionInput';

// Поля «следующей сессии»: день и необязательное время — один компонент на
// оба фронтенда (правило «одна механика — один компонент»); почему не datetime-local —
// sessionInput.ts. Оформление задаёт экран (`className`/`style`); `lang="ru"` — день и
// время по-русски, значение то же ISO (b30, сверка — sessionInput.test.tsx).
export function SessionDateTimeFields({
  value,
  onChange,
  className,
  style,
  dateRef,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
  dateRef?: Ref<HTMLInputElement>;
}) {
  const { date, time } = splitSession(value);
  const field = { className, style, lang: 'ru' };
  return (
    <>
      <input
        type="date"
        aria-label="День сессии"
        {...field}
        ref={dateRef}
        value={date}
        onChange={(e) => onChange(joinSession(e.target.value, time))}
      />
      <input
        type="time"
        aria-label="Время сессии, необязательно"
        {...field}
        value={time}
        onChange={(e) => onChange(joinSession(date, e.target.value))}
      />
    </>
  );
}
