import type { ReactNode } from 'react';
import { joinSession, splitSession } from './sessionInput';

export type SessionDayField = (day: {
  value: string;
  onChange: (day: string) => void;
  label: string;
}) => ReactNode;

// Поля «следующей сессии»: день и необязательное время — один компонент на
// оба фронтенда; почему не datetime-local — sessionInput.ts. День рисует экран
// (`renderDate`; сайт — DateField «26 ноября»), время — нативное с `lang="ru"`; значение то же ISO (сверка — sessionInput.test.tsx).
export function SessionDateTimeFields({
  value,
  onChange,
  className,
  renderDate,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  renderDate: SessionDayField;
}) {
  const { date, time } = splitSession(value);
  return (
    <>
      {renderDate({
        value: date,
        onChange: (d) => onChange(joinSession(d, time)),
        label: 'День сессии',
      })}
      <input
        type="time"
        aria-label="Время сессии, необязательно"
        className={className}
        lang="ru"
        value={time}
        onChange={(e) => onChange(joinSession(date, e.target.value))}
      />
    </>
  );
}
