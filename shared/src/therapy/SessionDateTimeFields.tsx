import type { CSSProperties, Ref } from 'react';
import { joinSession, splitSession } from './sessionInput';

// Поля «следующей сессии»: день и необязательное время — один компонент на
// оба фронтенда (правило «одна механика — один компонент»). Почему не одно
// datetime-local — в шапке sessionInput.ts. Оформление полей задаёт экран
// (`className` в webapp, `style` в мини-аппе).
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
  return (
    <>
      <input
        type="date"
        aria-label="День сессии"
        className={className}
        style={style}
        ref={dateRef}
        value={date}
        onChange={(e) => onChange(joinSession(e.target.value, time))}
      />
      <input
        type="time"
        aria-label="Время сессии, необязательно"
        className={className}
        style={style}
        value={time}
        onChange={(e) => onChange(joinSession(date, e.target.value))}
      />
    </>
  );
}
