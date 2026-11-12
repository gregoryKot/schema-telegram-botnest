import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { Tick } from './ui';

// Ссылка-приглашение в пару: подпись, ссылка в поле-листе и копирование кнопкой — для только что
// созданной и для ждущей ответа («Ждём партнёра»). Вид — по образцу блока кода-приглашения терапевта
// (shared/src/therapy/InviteCodeBox): сам он не подошёл — его подписи («Код для ввода вручную»,
// «Скопировать код») зашиты и относятся к коду терапевта. Один компонент на оба состояния пары.
export function PartnerInviteLink({ label, url }: { label: string; url: string }) {
  const copy = useCopyToClipboard();
  return (
    <div className="st-invite">
      <div className="st-invite-label">{label}</div>
      <div className="st-invite-field">{url}</div>
      <button type="button" className={`ds-btn ds-btn--sm ds-btn--secondary st-invite-copy${copy.failed ? ' st-btn-danger' : ''}`} onClick={() => void copy.copy(url)}>
        {copy.copied ? <><Tick />Скопировано</> : copy.failed ? 'Не скопировалось — ссылка выше' : 'Скопировать ссылку'}
      </button>
    </div>
  );
}
