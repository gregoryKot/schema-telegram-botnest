import type { ReactNode } from 'react';
import { ServicePage } from './ServicePage';

// Исход «Это не я» для экранов с кодом билета: вход (AuthConfirmPage) и
// привязка мессенджера (LinkDevicePage). Человеку, которого пытались обмануть,
// важно увидеть прямо: код не подтверждён, доступа никто не получил.
// `children` — что добавить под заголовком (своё пояснение, кнопка «дальше»).
export function TicketDenied({ children }: { children?: ReactNode }) {
  return (
    <ServicePage>
      <div className="as-body">
        <h1 className="ds-h2">Доступ никто не получил</h1>
        <p className="as-lead">
          Если этот код пришёл со стороны, всё правильно — подтверждать его не стоило.
        </p>
        {children}
      </div>
    </ServicePage>
  );
}
