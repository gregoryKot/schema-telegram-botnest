import type { TherapyClientSummary } from '../../api';
import { BottomSheet } from '../BottomSheet';
import { fmtDate } from '../../utils/format';
import type { ClientDetail } from './types';
import { ConceptHistoryList } from './ConceptHistoryList';
import { YsqPanel } from './YsqPanel';
import { SelfSchemaBadges } from './SelfSchemaBadges';
import { SchemaPicker } from './SchemaPicker';
import { ModePicker } from './ModePicker';
import { ConceptFieldsForm } from './ConceptFieldsForm';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

export function ConceptSheet({ selectedClient, detail }: Props) {
  const {
    conceptDirty,
    saveConcept,
    setShowConceptSheet,
    concept,
    showHistory,
    setShowHistory,
    localConcept,
    patchConcept,
    conceptSaving,
    conceptError,
    handleExport,
    exportCopied,
    activeSchemaIds,
    activeModeIds,
    ysqSchemaIds,
    selfSchemaIds,
    toggleSchemaId,
    toggleModeId,
  } = detail;

  return (
    <BottomSheet
      onClose={() => {
        if (conceptDirty) saveConcept();
        setShowConceptSheet(false);
      }}
    >
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            🗂 Концептуализация
          </div>
          {concept && (concept.history as unknown[])?.length > 0 && (
            <button
              onClick={() => setShowHistory((h) => !h)}
              style={{
                background: showHistory
                  ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                  : 'rgba(var(--fg-rgb),0.06)',
                border: 'none',
                borderRadius: 10,
                padding: '5px 10px',
                color: showHistory ? 'var(--accent)' : 'var(--text-sub)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              🕐 История ({(concept.history as unknown[]).length})
            </button>
          )}
        </div>
        {showHistory &&
          concept &&
          (concept.history as unknown[])?.length > 0 && (
            <ConceptHistoryList concept={concept} detail={detail} />
          )}
        <YsqPanel selectedClient={selectedClient} detail={detail} />
        <SelfSchemaBadges selfSchemaIds={selfSchemaIds} />
        <SchemaPicker
          activeSchemaIds={activeSchemaIds}
          ysqSchemaIds={ysqSchemaIds}
          toggleSchemaId={toggleSchemaId}
        />
        <ModePicker activeModeIds={activeModeIds} toggleModeId={toggleModeId} />
        <ConceptFieldsForm
          localConcept={localConcept}
          patchConcept={patchConcept}
        />
        <button
          onClick={saveConcept}
          disabled={conceptSaving || !conceptDirty}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 14,
            border: 'none',
            background: conceptDirty
              ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 30%, transparent), rgba(79,163,247,0.2))'
              : 'rgba(var(--fg-rgb),0.05)',
            color: conceptDirty ? 'var(--text)' : 'rgba(var(--fg-rgb),0.25)',
            fontSize: 14,
            fontWeight: 600,
            cursor: conceptDirty ? 'pointer' : 'default',
            opacity: conceptSaving ? 0.6 : 1,
          }}
        >
          {conceptSaving
            ? 'Сохраняю...'
            : conceptDirty
              ? 'Сохранить концептуализацию'
              : concept
                ? `✓ Сохранено ${fmtDate(concept.updatedAt.slice(0, 10))}`
                : 'Нет изменений'}
        </button>
        {conceptError && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--accent-red)',
              textAlign: 'center',
              marginTop: 6,
            }}
          >
            {conceptError}
          </div>
        )}
        {concept && (
          <button
            onClick={handleExport}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '11px 0',
              borderRadius: 14,
              border: '1px solid rgba(var(--fg-rgb),0.1)',
              background: exportCopied
                ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                : 'transparent',
              color: exportCopied ? '#06d6a0' : 'rgba(var(--fg-rgb),0.4)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {exportCopied ? '✓ Скопировано' : '↗ Экспорт / Поделиться'}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
