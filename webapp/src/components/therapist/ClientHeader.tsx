import { useEffect, useRef } from 'react';
import type { TherapyClientSummary } from '../../api';
import { todayStr } from '../../utils/format';
import { calcTherapyDuration, nextSessionLabel } from './clientSheetHelpers';
import type { ClientDetail, ClientTab } from './clientSheetTypes';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
  switchView: (v: 'list' | 'client') => void;
}

export function ClientHeader({ selectedClient, detail, switchView }: Props) {
  const {
    clientSchemaNotesData, clientModeNotesData, clientTasks, notes, clientData, clientDiary,
    setShowAssign,
    renamingAlias, setRenamingAlias, aliasInput, setAliasInput, aliasSaving, aliasError,
    deleteClient, deleteLoading, deleteError,
    clientTab, setClientTab, saveAlias,
  } = detail;

  const aliasInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renamingAlias) aliasInputRef.current?.focus();
  }, [renamingAlias]);

  return (
    <div className="therapist-client-header" style={{ borderBottom: '1px solid var(--line)', padding: '24px 48px 0', flexShrink: 0 }}>
      {/* Row 1: back + name + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={() => switchView('list')}
          style={{ background: 'none', border: 'none', fontSize: 12.5, color: 'var(--text-faint)', cursor: 'pointer', padding: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
          ← Все клиенты
        </button>
        <span style={{ color: 'rgba(var(--fg-rgb),0.15)', fontSize: 12 }}>|</span>

        {/* Name / inline edit */}
        {renamingAlias ? (
          <>
            <input ref={aliasInputRef} value={aliasInput} onChange={e => setAliasInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAlias(); if (e.key === 'Escape') setRenamingAlias(false); }}
              style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', width: 220, padding: '1px 0', color: 'var(--text)' }} />
            <button onClick={saveAlias} disabled={aliasSaving} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 12, cursor: 'pointer' }}>
              {aliasSaving ? '…' : 'OK'}
            </button>
            <button onClick={() => setRenamingAlias(false)} aria-label="Отменить" style={{ padding: '3px 7px', borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}>✕</button>
            {aliasError && <span style={{ fontSize: 12, color: 'var(--c-rose)' }}>{aliasError}</span>}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 380 }}>
              {selectedClient.clientAlias ?? selectedClient.name ?? `ID ${selectedClient.telegramId}`}
            </span>
            <button onClick={() => { setRenamingAlias(true); setAliasInput(selectedClient.clientAlias ?? selectedClient.name ?? ''); }}
              style={{ background: 'none', border: 'none', padding: '2px 5px', borderRadius: 4, color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }} title="Переименовать" aria-label="Переименовать">✎</button>
            {/* Inline meta */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
              {selectedClient.lastActiveDate === todayStr() && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--c-moss)', flexShrink: 0 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--c-moss)' }} />был сегодня
                </span>
              )}
              {!selectedClient.name && (
                <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>оффлайн</span>
              )}
              {selectedClient.therapyStartDate && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {calcTherapyDuration(selectedClient.therapyStartDate)}
                </span>
              )}
              {selectedClient.nextSession && (
                <span style={{ fontSize: 12, color: 'var(--text-sub)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  сессия {nextSessionLabel(selectedClient.nextSession)}
                </span>
              )}
              {selectedClient.streak > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>🔥 {selectedClient.streak} дн.</span>
              )}
            </div>
          </div>
        )}

        {/* Actions — right */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 'auto', alignItems: 'center' }}>
          <button onClick={() => setShowAssign(true)} className="btn btn-primary">+ Задание</button>
          <button onClick={() => setClientTab('sessions')} className="btn btn-secondary">+ Заметка</button>
          <button onClick={deleteClient} disabled={deleteLoading} title="Удалить клиента" aria-label="Удалить клиента"
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', fontSize: 14, color: 'var(--text-faint)', cursor: 'pointer' }}>
            {deleteLoading ? '…' : '🗑'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {([
          ['overview', 'Обзор', null],
          ['concept', 'Концептуализация', null],
          ['mode_map', 'Карта режимов', null],
          ['sessions', 'Сессии', notes.length],
          ['tasks', 'Задания', clientTasks.length],
          ['ysq', 'Схемы', clientData?.ysqHistory?.length ?? 0],
          ['client_notes', 'Записи клиента', clientSchemaNotesData.length + clientModeNotesData.length + clientDiary.length],
        ] as [ClientTab, string, number | null][]).map(([t, label, count]) => (
          <button key={t} className={`tab${clientTab === t ? ' is-active' : ''}`} onClick={() => setClientTab(t)}>
            {label}
            {count != null && count > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--surface-3)', borderRadius: 10, padding: '1px 6px', fontSize: 10.5, fontWeight: 500 }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {deleteError && <div style={{ padding: '8px 0', fontSize: 13, color: 'var(--c-rose)' }}>{deleteError}</div>}
    </div>
  );
}
