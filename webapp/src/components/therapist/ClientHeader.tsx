import { useEffect, useRef } from 'react';
import type { TherapyClientSummary } from '../../api';
import { ClientHeaderBadges } from './ClientHeaderBadges';
import { ClientTabs } from './ClientTabs';
import { clientInitials } from './clientOverviewModel';
import type { ClientDetail } from './clientSheetTypes';
import { ConfirmDialog } from '../ConfirmDialog';
import { MMIcon } from '../modeMapIcons';
import { CLIENT_NAME_MAX } from '../../../../shared/src/limits/textLimits';
import { removeClientConfirmCopy } from '../../../../shared/src/therapy/removeClientConfirm';
import { clientHue, hueStyle } from '../../lib/tone';
import '../../styles/therapist-card.css';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
  switchView: (v: 'list' | 'client') => void;
}

export function ClientHeader({ selectedClient, detail, switchView }: Props) {
  const {
    setShowAssign, setClientTab,
    renamingAlias, setRenamingAlias, aliasInput, setAliasInput, aliasSaving, aliasError,
    deleteClient, requestDeleteClient, cancelDeleteClient, confirmingDelete, deleteLoading, deleteError, saveAlias,
  } = detail;

  const removeCopy = removeClientConfirmCopy(selectedClient);
  const aliasInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renamingAlias) aliasInputRef.current?.focus();
  }, [renamingAlias]);
  const displayName = selectedClient.clientAlias ?? selectedClient.name ?? `ID ${selectedClient.telegramId}`;

  return (
    <div className="tk-head">
      <button className="ds-sub tk-back" onClick={() => switchView('list')}>← Все клиенты</button>
      <div className="tk-head-row">
        <div className="ds-avatar ds-avatar--serif tk-avatar" style={hueStyle(clientHue(selectedClient.telegramId))}>
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
            <div className="tk-name-row">
              <span className="tk-name">{displayName}</span>
              <button className="tk-edit" title="Переименовать" aria-label="Переименовать"
                onClick={() => { setRenamingAlias(true); setAliasInput(selectedClient.clientAlias ?? selectedClient.name ?? ''); }}>✎</button>
            </div>
          )}
          <ClientHeaderBadges client={selectedClient} />
        </div>
        <div className="tk-actions">
          <div className="tk-actions-main">
            <button className="ds-btn ds-btn--sm" onClick={() => setShowAssign(true)}>+ Задание</button>
            <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setClientTab('sessions')}>+ Заметка</button>
          </div>
          <button className="ds-btn ds-btn--icon" onClick={requestDeleteClient} disabled={deleteLoading} title="Удалить клиента" aria-label="Удалить клиента">
            {deleteLoading ? '…' : <MMIcon name="trash" size={16} />}
          </button>
        </div>
      </div>
      <ClientTabs detail={detail} />
      {deleteError && <div className="tk-error" role="alert">{deleteError}</div>}
      {confirmingDelete && (
        <ConfirmDialog title={removeCopy.title} message={removeCopy.message} confirmLabel="Удалить" onConfirm={deleteClient} onCancel={cancelDeleteClient} />
      )}
    </div>
  );
}
