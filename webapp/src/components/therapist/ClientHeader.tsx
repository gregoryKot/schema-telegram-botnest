import { useEffect, useRef } from 'react';
import type { TherapyClientSummary } from '../../api';
import { ClientHeaderBadges } from './ClientHeaderBadges';
import { RenameDeleteMenu } from '../RenameDeleteMenu';
import { ClientQuickActions } from './ClientQuickActions';
import { ClientTabs } from './ClientTabs';
import { clientInitials } from '../../../../shared/src/therapy/clientInitials';
import type { ClientDetail } from './clientSheetTypes';
import { HistoryConfirmDialog } from '../HistoryConfirmDialog';
import { useIsMobile } from '../useIsMobile';
import { CLIENT_NAME_MAX } from '../../../../shared/src/limits/textLimits';
import { removeClientConfirmCopy } from '../../../../shared/src/therapy/removeClientConfirm';
import { clientHue, hueStyle } from '../../lib/tone';
import '../../styles/therapist-card.css';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
  switchView: (v: 'list' | 'client') => void;
}

// Шапка карточки клиента (#906, волна 1): аватар tint с тёмными инициалами,
// имя ds-h2, строка-мета и «Встреча» + дата; редкие действия (переименовать,
// удалить) — в меню «⋯». «+ Задание / + Заметка» здесь только на ноутбуке: на
// телефоне они первой строкой «Обзора», закреплённой панели над навигацией нет.
export function ClientHeader({ selectedClient, detail, switchView }: Props) {
  const {
    renamingAlias, setRenamingAlias, aliasInput, setAliasInput, aliasSaving, aliasError,
    deleteClient, requestDeleteClient, cancelDeleteClient, confirmingDelete, deleteLoading, deleteError, saveAlias, clientTab,
  } = detail;
  const phone = useIsMobile();
  const removeCopy = removeClientConfirmCopy(selectedClient);
  const aliasInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renamingAlias) aliasInputRef.current?.focus(); }, [renamingAlias]);
  const displayName = selectedClient.clientAlias ?? selectedClient.name ?? `ID ${selectedClient.telegramId}`;
  const startRename = () => { setRenamingAlias(true); setAliasInput(selectedClient.clientAlias ?? selectedClient.name ?? ''); };

  return (
    <div className={`tk-head${clientTab === 'mode_map' ? ' tk-head--wide' : ''}`}>
      <button className="ds-back" onClick={() => switchView('list')}>← Все клиенты</button>
      <div className="tk-head-row">
        <div className="ds-avatar ds-avatar--serif tone-tint tk-avatar" style={hueStyle(clientHue(selectedClient.telegramId))}>
          {clientInitials(displayName)}
        </div>
        <div className="tk-ident">
          {renamingAlias ? (
            <div className="tk-alias-form">
              <input ref={aliasInputRef} className="tk-alias-input" value={aliasInput} onChange={e => setAliasInput(e.target.value)}
                maxLength={CLIENT_NAME_MAX}
                onKeyDown={e => { if (e.key === 'Enter') saveAlias(); if (e.key === 'Escape') setRenamingAlias(false); }} />
              <button className="ds-btn ds-btn--sm" onClick={saveAlias} disabled={aliasSaving}>{aliasSaving ? '…' : 'OK'}</button>
              <button className="ds-btn ds-btn--icon" onClick={() => setRenamingAlias(false)} aria-label="Отменить">✕</button>
              {aliasError && <span className="tk-error">{aliasError}</span>}
            </div>
          ) : (
            <h1 className="ds-h2 tk-name">{displayName}</h1>
          )}
          <ClientHeaderBadges client={selectedClient} />
        </div>
        <div className="tk-actions">
          {!phone && <ClientQuickActions detail={detail} primary />}
          <RenameDeleteMenu label="Действия с карточкой" deleteLabel="Удалить клиента" onRename={startRename} onDelete={requestDeleteClient} deleteBusy={deleteLoading} />
        </div>
      </div>
      <ClientTabs detail={detail} />
      {deleteError && <div className="tk-error" role="alert">{deleteError}</div>}
      {confirmingDelete && (
        <HistoryConfirmDialog title={removeCopy.title} message={removeCopy.message} confirmLabel="Удалить" onConfirm={deleteClient} onCancel={cancelDeleteClient} />
      )}
    </div>
  );
}
