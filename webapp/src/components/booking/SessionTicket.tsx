import type { ReactNode } from 'react';
import { ticketWhen } from './sessionTicketModel';
import '../../styles/client-booking.css';

/**
 * «Билетик» сессии (b24): белый лист с тенью-слоем, слева корешок — день (Literata) и время, справа — надпись,
 * статус и ссылки; между ними линия отрыва с вырезами. Один на карточку «Терапевт» профиля (следующая сессия,
 * своя бронь) и лист записи (выбранное окно). Строка «когда» остаётся целой для чтения с экрана и копирования
 * («Вс, 15 ноя · 18:00»): разделитель скрыт только глазу. Цвет выреза — бумага под билетом (--cbk-cut).
 */
export function SessionTicket({ when, label, className, row, children }: {
  /** Готовая строка «когда» (nextSessionLabel, sessionWhen) — формат задаёт место, билет его не меняет. */
  when: string;
  label?: ReactNode;
  className?: string;
  /** Лист записи: билет во всю колонку и всегда в ряд (день и время слева, цена справа), и на 320. */
  row?: boolean;
  children?: ReactNode;
}) {
  const { day, sep, time } = ticketWhen(when);
  const body = label || children;
  return (
    <div className={['cbk-ticket-box', row && 'cbk-ticket-box--row', !children && 'cbk-ticket-box--label', className].filter(Boolean).join(' ')}>
      <div className={body ? 'cbk-ticket' : 'cbk-ticket cbk-ticket--stub'}>
        <p className="cbk-ticket-when">
          <span className="cbk-ticket-day">{day}</span>
          {time && <><span className="cbk-ticket-sep">{sep}</span><span className="cbk-ticket-time">{time}</span></>}
        </p>
        {body && (
          <div className="cbk-ticket-body">
            {label && <span className="ds-label cbk-ticket-label">{label}</span>}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
