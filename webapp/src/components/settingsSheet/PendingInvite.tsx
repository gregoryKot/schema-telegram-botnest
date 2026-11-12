import type { ReactNode } from 'react';
import { useTr } from '../../utils/addressForm';
import { PartnerInviteLink } from './PartnerInviteLink';

// Ждущее приглашение в пару: ссылка для повторной отправки и отмена. Отмена —
// та же ручка, что выход из пары (`DELETE /api/pair` с кодом): создателю
// ждущей пары сервер её удаляет (`PairsService.leavePair`), и ссылка, уже
// ушедшая в чаты, больше никого не впускает. До 2026-11 отменить приглашение
// было нельзя — только ждать, пока истечёт срок (BACKLOG «Пара с другом»).
export function PendingInvite({ label, url, onCancel, failed, actions }: {
  label: string;
  /** Пусто, если сервер не смог собрать ссылку (бот не настроен) — отмена всё равно доступна. */
  url: string;
  onCancel: () => void;
  failed: boolean;
  /** Соседние действия раздела («Новая ссылка», «Ввести код») — в одном ряду с копированием; отмена — последней строкой. */
  actions?: ReactNode;
}) {
  const tr = useTr();
  return (
    <div className="st-pending">
      {url ? <PartnerInviteLink label={label} url={url} actions={actions} /> : (
        <><div className="st-invite-label">{label}</div><div className="st-actions">{actions}</div></>
      )}
      {failed && (
        <div className="st-err">
          {tr('Не получилось отменить приглашение. Попробуй ещё раз', 'Не получилось отменить приглашение. Попробуйте ещё раз')}
        </div>
      )}
      <button type="button" className="ds-link ds-link--danger" onClick={onCancel}>Отменить приглашение</button>
    </div>
  );
}
