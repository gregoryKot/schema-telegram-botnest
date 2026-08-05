import { BottomSheet } from '../BottomSheet';
import { SectionLabel } from '../SectionLabel';
import { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { SCHEMA_DOMAINS, ALL_SCHEMAS } from '../../schemaTherapyData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { CONCEPT_FIELDS } from './helpers';
import { ClientDetail } from './types';
import { ConceptModePicker } from './conceptSheet/ConceptModePicker';
import { ConceptHistoryPanel } from './conceptSheet/ConceptHistoryPanel';
import { ConceptYsqHistory } from './conceptSheet/ConceptYsqHistory';
import { cm } from '../../sections/schemas/utils';
interface ConceptSheetProps {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

export function ConceptSheet({ selectedClient, detail }: ConceptSheetProps) {
  const {
    concept,
    localConcept,
    conceptDirty,
    conceptSaving,
    conceptError,
    showHistory,
    setShowHistory,
    setShowConceptSheet,
    ysqRequested,
    ysqError,
    exportCopied,
    activeSchemaIds,
    ysqSchemaIds,
    selfSchemaIds,
    activeModeIds,
    patchConcept,
    toggleSchemaId,
    toggleModeId,
    saveConcept,
    handleRequestYsq,
    handleExport,
  } = detail;

  return (
    <BottomSheet
      onClose={() => {
        if (conceptDirty) void saveConcept();
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
            Концептуализация
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
              История ({(concept.history as unknown[]).length})
            </button>
          )}
        </div>
        <ConceptHistoryPanel detail={detail} />
        {selectedClient.telegramId > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={handleRequestYsq}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 12,
                border: `1px solid ${cm('var(--accent-blue)', 20)}`,
                background: cm('var(--accent-blue)', 6),
                color: ysqRequested ? '#06d6a0' : cm('var(--accent-blue)', 80),
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {ysqRequested ? '✓ Запрос отправлен' : 'Запросить тест на схемы'}
            </button>
            {ysqError && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--accent-red)',
                  marginTop: 6,
                  textAlign: 'center',
                }}
              >
                {ysqError}
              </div>
            )}
          </div>
        )}
        <ConceptYsqHistory detail={detail} />
        {selfSchemaIds.length > 0 && (
          <div
            style={{
              background: 'rgba(var(--fg-rgb),0.03)',
              border: '1px solid rgba(var(--fg-rgb),0.07)',
              borderRadius: 14,
              padding: '10px 14px',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.07em',
                color: 'var(--text-sub)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Схемы клиента (самооценка)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {selfSchemaIds.map((id) => {
                const schema = ALL_SCHEMAS.find((s) => s.id === id);
                return schema ? (
                  <span
                    key={id}
                    style={{
                      fontSize: 11,
                      padding: '3px 9px',
                      borderRadius: 20,
                      background: 'rgba(var(--fg-rgb),0.07)',
                      color: 'var(--text-sub)',
                    }}
                  >
                    <IdentityDot color={schema.domainColor} size={7} />{' '}
                    {schema.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
        <SectionLabel mb={8}>Актуальные схемы (ЭДС)</SectionLabel>
        {SCHEMA_DOMAINS.map((domain) => (
          <div key={domain.id} style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.07em',
                color: domain.color + 'aa',
                textTransform: 'uppercase',
                marginBottom: 5,
                paddingLeft: 2,
              }}
            >
              {domain.domain}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {domain.schemas.map((schema) => {
                const active = activeSchemaIds.includes(schema.id);
                const fromYsq = ysqSchemaIds.includes(schema.id);
                return (
                  <button
                    key={schema.id}
                    onClick={() => toggleSchemaId(schema.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 20,
                      cursor: 'pointer',
                      border: fromYsq
                        ? `1px solid ${domain.color}55`
                        : '1px solid transparent',
                      background: active
                        ? domain.color + '30'
                        : 'rgba(var(--fg-rgb),0.05)',
                      color: active ? domain.color : 'rgba(var(--fg-rgb),0.45)',
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      transition: 'all 0.15s ease',
                    }}
                    title={schema.desc}
                  >
                    <IdentityDot color={domain.color} size={7} /> {schema.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6 }}>
          <SectionLabel mb={8}>Карта режимов</SectionLabel>
        </div>
        <ConceptModePicker
          activeModeIds={activeModeIds}
          onToggle={toggleModeId}
        />
        <div style={{ marginTop: 8 }}>
          {CONCEPT_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  color: 'var(--text-sub)',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}
              >
                {label}
              </div>
              <textarea
                value={(localConcept[key] as string) ?? ''}
                onChange={(e) => patchConcept({ [key]: e.target.value })}
                placeholder={placeholder}
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(var(--fg-rgb),0.04)',
                  border: '1px solid rgba(var(--fg-rgb),0.08)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--text)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={saveConcept}
          disabled={conceptSaving || !conceptDirty}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 14,
            border: 'none',
            background: conceptDirty
              ? `linear-gradient(135deg, color-mix(in srgb, var(--accent) 30%, transparent), ${cm('var(--accent-blue)', 20)})`
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
