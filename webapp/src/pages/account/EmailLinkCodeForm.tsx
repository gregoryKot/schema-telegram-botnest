import { useState } from 'react';
import { USER_CODE_LENGTH } from '../../../../shared/src/auth/userCodeEntry';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';
import { sessionPost } from '../../components/stepUp/sessionRequest';
import { TicketCodeField } from '../service/TicketCodeField';

const FAILED = 'Код не подошёл или истёк';

// Привязка почты кодом из письма (src/auth/email-link-code.ts). Ссылка из
// письма срабатывает только в браузере, где открыт аккаунт; когда приложение
// открыто внутри Telegram или MAX, письмо открывается в другой программе — и
// привязать адрес можно только кодом, здесь же, где привязку запросили.
// С 2026-11 это путь на сайт для тех, кто входил только через Telegram.
export function EmailLinkCodeForm({ accessToken, onLinked, onError }: {
  accessToken: string | null;
  /** Адрес привязан — экрану пора перечитать способы входа. */
  onLinked: () => void;
  onError: (message: string | null) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const res = await sessionPost('/api/auth/email/link-code', accessToken, { code })();
      if (!res.ok) throw new Error((await readHumanError(res, FAILED)).message);
      onLinked();
    } catch (err) {
      onError(humanizeThrown(err, FAILED));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={confirm} className="aa-email-code">
      <TicketCodeField label="Код из письма" value={code} onChange={setCode} matches disabled={busy} />
      <button type="submit" disabled={busy || code.length !== USER_CODE_LENGTH} className="ds-btn ds-btn--sm">
        {busy ? '…' : 'Привязать'}
      </button>
    </form>
  );
}
