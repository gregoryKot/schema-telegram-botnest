import { useState, type ReactNode } from 'react';
import type { TherapyNudgePlace, TherapyNudgeTrigger } from '../../../../shared/src/analytics/therapyNudge';
import { getTherapistContact, hasConnectedTherapist } from '../../../../shared/src/utils/therapistContact';
import { TalkSheet } from './TalkSheet';
import { trackTherapyNudge } from './trackTherapyNudge';

export interface TherapyTarget {
  /** Пользователь сам терапевт: мост ему не показываем. */
  hidden: boolean;
  /** К пользователю подключён свой терапевт (с каналом связи или без): строка говорит о встречах, а не «если нужна терапия». */
  connected: boolean;
  /** Терапевт подключён и до него есть канал: внешняя ссылка; `onClick` пишет событие write. Иначе undefined. */
  write?: { url: string; onClick: () => void };
  /** Ссылки write нет: открыть лист (событие open) — «Поговорить с кем-то», а при терапевте без канала «Терапевт рядом». */
  open: () => void;
  /** Лист, когда открыт; вставляется в разметку вызывающего вне `<p>`. */
  sheet: ReactNode;
}

/**
 * Куда ведёт «поговорить» из места `place`: подключён терапевт — ссылка на него
 * (write), нет — лист с записью к автору (open). Единственная копия этой развилки
 * для строки, карточки по сигналу и «Ещё».
 */
export function useTherapyTarget(place: TherapyNudgePlace, trigger?: TherapyNudgeTrigger): TherapyTarget {
  const [isOpen, setOpen] = useState(false);
  const contact = getTherapistContact();
  const connected = hasConnectedTherapist(contact);
  return {
    hidden: contact.isTherapist,
    connected,
    write: connected && contact.url
      ? { url: contact.url, onClick: () => trackTherapyNudge(place, 'write', trigger) }
      : undefined,
    open: () => {
      trackTherapyNudge(place, 'open', trigger);
      setOpen(true);
    },
    sheet: isOpen ? <TalkSheet place={place} trigger={trigger} onClose={() => setOpen(false)} /> : null,
  };
}
