import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';

// Ссылка-приглашение в пару с подписью и копированием: для только что
// созданной и для ждущей ответа («⏳ Ждём партнёра»). Парна PairPanel/InviteLinkBox
// мини-аппа (правило №3).
export function PartnerInviteLink({ label, url }: { label: string; url: string }) {
  const copy = useCopyToClipboard();
  return (
    <div>
      <div className="st-text st-text--faint">{label}</div>
      <div className="st-mono st-mb10">{url}</div>
      <button className={`ds-link${copy.copied ? ' is-ok' : copy.failed ? ' st-link-danger' : ''}`} onClick={() => void copy.copy(url)}>
        {copy.copied ? '✓ Скопировано' : copy.failed ? 'Не скопировалось — ссылка выше' : 'Скопировать ссылку'}
      </button>
    </div>
  );
}
