import { useState, type ReactNode } from 'react';
import type { TherapyNudgePlace, TherapyNudgeTrigger } from '../../../../shared/src/analytics/therapyNudge';
import { getTherapistContact, hasConnectedTherapist } from '../../../../shared/src/utils/therapistContact';
import { TalkSheet } from './TalkSheet';
import { trackTherapyNudge } from './trackTherapyNudge';

export interface TherapyTarget {
  /** Пользователь сам терапевт: мост ему не показываем. */
  hidden: boolean;
  /** Терапевт подключён: внешняя ссылка на него; `onClick` пишет событие write. Иначе undefined. */
  write?: { url: string; onClick: () => void };
  /** Терапевт не подключён: открыть лист «Поговорить с кем-то» (событие open). */
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
  return {
    hidden: contact.isTherapist,
    write: hasConnectedTherapist(contact)
      ? { url: contact.url, onClick: () => trackTherapyNudge(place, 'write', trigger) }
      : undefined,
    open: () => {
      trackTherapyNudge(place, 'open', trigger);
      setOpen(true);
    },
    sheet: isOpen ? <TalkSheet place={place} trigger={trigger} onClose={() => setOpen(false)} /> : null,
  };
}
