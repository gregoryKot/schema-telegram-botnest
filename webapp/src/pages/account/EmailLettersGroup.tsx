import { unlinkBlockedWhy } from './accountMethods';
import { EmailLinkRow } from './EmailLinkRow';
import type { EmailLinkNotice } from './emailLinkNotice';
import type { AccountProvider } from './ProviderRows';
import { RowsSkeleton } from './SignInMethods';

// Почта — не способ входа (вход по ней отключён, ч. 10 ст. 8 149-ФЗ), а адрес для
// писем: своя группа рядом со «Способами входа», в том же плоском виде.
export function EmailLettersGroup({
  providers, userId, loading, busy, accessToken, onUnlink, notice = null, onLinked,
}: {
  providers: AccountProvider[];
  userId: string | null;
  loading: boolean; busy: boolean;
  accessToken: string | null;
  onUnlink: () => void;
  /** Возврат по ссылке из письма (?linked=email, ?error=…) — у строки адреса. */
  notice?: EmailLinkNotice | null;
  onLinked: () => void;
}) {
  const row = providers.find((p) => p.provider === 'email');
  return (
    <section className="aa-group">
      <div className="aa-group-head">
        <h2 className="ds-h3">Почта для писем</h2>
      </div>
      {loading ? <RowsSkeleton rows={1} /> : (
        <div className="aa-methods">
          <EmailLinkRow accessToken={accessToken} linked={!!row} busy={busy} email={row?.email}
            unlinkBlockedWhy={unlinkBlockedWhy(providers, 'email', userId)}
            onUnlink={onUnlink} notice={notice} onLinked={onLinked} />
        </div>
      )}
    </section>
  );
}
