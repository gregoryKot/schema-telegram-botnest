import { useTr } from '../utils/addressForm';

// Отказ по заявке на роль психолога — один блок на оба фронтенда (правило
// №3): настройки сайта и мини-аппа, страница /account. До 2026-11 мини-апп
// отказ не рисовал вовсе (после него — та же кнопка подачи, что и до заявки),
// а /account показывал причину только внутри раскрытой формы. Блок стоит
// прямо над кнопкой подачи и отвечает «что случилось и что дальше»:
// причина от администратора и то, что подать можно снова.

export interface TherapistRequestLike {
  status: string;
  rejectReason: string | null;
}

/** Текст отказа; не отказ (нет заявки, на рассмотрении, одобрена) — null. */
export function rejectedRequestText(
  req: TherapistRequestLike | null | undefined,
  tr: (ty: string, vy: string) => string,
): string | null {
  if (req?.status !== 'rejected') return null;
  // Точку ставит шаблон: хвостовая пунктуация причины дала бы «..» или «!.».
  const reason = req.rejectReason?.trim().replace(/[.!?…\s]+$/u, '');
  return (
    `Прошлая заявка отклонена${reason ? `: ${reason}` : ''}. ` +
    tr('Можешь подать новую.', 'Можете подать новую.')
  );
}

/** Обёртку и отступы задаёт экран (`className`), цвет — общий токен. */
export function TherapistRequestRejectedNote({
  request,
  className,
}: {
  request: TherapistRequestLike | null | undefined;
  className?: string;
}) {
  const tr = useTr();
  const text = rejectedRequestText(request, tr);
  if (!text) return null;
  return (
    <div
      role="note"
      className={className}
      style={{ color: 'var(--accent-red)', fontSize: 13, lineHeight: 1.5 }}
    >
      {text}
    </div>
  );
}
