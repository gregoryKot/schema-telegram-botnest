import type { ReactNode } from 'react';
import { joinSession, splitSession } from './sessionInput';

export type SessionDayField = (day: {
  value: string;
  onChange: (day: string) => void;
  label: string;
}) => ReactNode;

// День и необязательное время сессии (почему не datetime-local — sessionInput.ts); день рисует
// экран через `renderDate` (сайт — DateField «26 ноября»): shared не импортирует webapp.
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
