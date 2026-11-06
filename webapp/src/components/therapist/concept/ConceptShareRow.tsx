import { useId } from 'react';
import { useTr } from '../../../utils/addressForm';
import { isVirtualClient } from '../../../../../shared/src/therapy/clientSheetHelpers';
import type { ClientDetail } from '../clientSheetTypes';
import { Toggle } from '../../settingsSheet/ui';
import { useConceptShare } from './useConceptShare';
import { CONCEPT_SHARE_TITLE, conceptShareError, conceptShareHint } from './conceptShareText';

// Строка «Показать клиенту» под шапкой вкладки «Концептуализация» (оба вида): решение
// показывать ли схему случая — у терапевта, по каждому клиенту; по умолчанию выключено.
// Подпись говорит, что увидит клиент, а после включения — с какого дня он это видит.
// Офлайн-клиенту (без аккаунта) показывать некому — строки нет. Тумблер — общий ds-switch
// настроек (Toggle), зона нажатия 44×44 — из cabinet.css.
export function ConceptShareRow({ detail }: { detail: ClientDetail }) {
  const tr = useTr();
  const id = useId();
  const client = detail.selectedClient;
  const share = useConceptShare(client?.telegramId, detail.concept?.sharedWithClientAt);
  if (!client || isVirtualClient(client)) return null;
  return (
    <>
      <div className="tcp-share">
        <div className="tcp-share-text">
          <span className="tcp-share-title">{CONCEPT_SHARE_TITLE}</span>
          <span id={id} className="tcp-share-sub">{conceptShareHint(share.sharedAt)}</span>
        </div>
        <Toggle on={share.shared} label={CONCEPT_SHARE_TITLE} describedBy={id} onClick={() => void share.toggle()} />
      </div>
      {share.failed && <div role="alert" className="tcp-status is-err">{conceptShareError(tr)}</div>}
    </>
  );
}
