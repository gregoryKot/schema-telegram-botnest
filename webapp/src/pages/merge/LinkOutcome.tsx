import { useNavigate } from 'react-router-dom';
import { useTr } from '../../utils/addressForm';
import { PaperOutcome } from '../../components/paper/PaperOutcome';
import type { LinkFailOutcome } from './linkFailModel';

// Исходы /link (docs/design/APP_2026-11.md, «Исходы служебных страниц»): «Готово» — done с главным
// действием; «Это не я» — limit (граница удержана); сводка не загрузилась — wait (код не найден,
// устарел, лимит) или our_side (сбой сервера, сеть). У каждого исхода есть выход — раньше у ошибки и
// у «Готово» кнопки не было.
export function LinkOutcome({ kind, messenger, error }: {
  kind: 'done' | 'denied' | LinkFailOutcome;
  messenger: string;
  /** Текст ошибки сводки — заголовок исхода wait / our_side. */
  error?: string | null;
}) {
  const tr = useTr();
  const navigate = useNavigate();
  const toAccount = { label: 'В аккаунт', onClick: () => navigate('/account') };

  if (kind === 'denied') {
    // «Это не я» на экране входа (TicketDenied) говорит то же: доступа никто не получил.
    return (
      <PaperOutcome
        outcome="limit" title="Доступ никто не получил"
        lead="Если этот код пришёл со стороны, всё правильно — подтверждать его не стоило."
        action={toAccount}
      >
        <p className="pa-outcome-lead">
          Код не подтверждён: приложение в {messenger} не получило доступ к аккаунту, данные остались на месте.
        </p>
      </PaperOutcome>
    );
  }
  if (kind === 'done') {
    return (
      <PaperOutcome
        outcome="done" eyebrow="Аккаунт" title="Готово"
        lead={<>{tr('Вернись в приложение', 'Вернитесь в приложение')} — оно уже работает с этим аккаунтом.</>}
        action={toAccount}
      />
    );
  }
  if (kind === 'wait') return <PaperOutcome outcome="wait" eyebrow="Аккаунт" title={error} action={toAccount} />;
  return (
    <PaperOutcome
      outcome="our_side" eyebrow="Аккаунт" title={error}
      action={{ label: 'Повторить', onClick: () => window.location.reload() }} link={toAccount}
    />
  );
}
