import type { ReactNode } from 'react';
import { PaperOutcome } from '../../components/paper/PaperOutcome';

// Исход «Это не я» для экранов с кодом билета: вход (AuthConfirmPage) и
// привязка мессенджера (LinkDevicePage). Человеку, которого пытались обмануть,
// важно увидеть прямо: код не подтверждён, доступа никто не получил. Граница
// удержана — PaperOutcome `limit` (Limits на небе).
// `children` — что добавить под заголовком (своё пояснение, кнопка «дальше»).
export function TicketDenied({ children }: { children?: ReactNode }) {
  return (
    <PaperOutcome outcome="limit" title="Доступ никто не получил"
                  lead="Если этот код пришёл со стороны, всё правильно — подтверждать его не стоило.">
      {children}
    </PaperOutcome>
  );
}
