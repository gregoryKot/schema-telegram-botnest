import { BottomSheet } from '../BottomSheet';
import { SectionLabel } from '../SectionLabel';
import { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { CONCEPT_FIELDS } from './helpers';
import { ClientDetail } from './types';

interface ConceptSheetProps {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

export function ConceptSheet({ selectedClient, detail }: ConceptSheetProps) {
  const {
    concept,
    clientData,
    localConcept,
    setLocalConcept,
    conceptDirty,
    setConceptDirty,
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
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {concept.history.map((snap, i) => {
                  const snapSchemas = (snap.schemaIds ?? [])
                    .map((id) => {
                      const domain = SCHEMA_DOMAINS.find((d) =>
                        d.schemas.some((s) => s.id === id),
                      );
                      const schema = domain?.schemas.find((s) => s.id === id);
                      return schema ? { schema, color: domain!.color } : null;
                    })
                    .filter(Boolean) as {
                    schema: { id: string; name: string; emoji: string };
                    color: string;
                  }[];
                  const textFields = [
                    { label: 'Цель', val: snap.goals },
                    { label: 'Опыт', val: snap.earlyExperience },
                    { label: 'Потребности', val: snap.unmetNeeds },
                    { label: 'Триггеры', val: snap.triggers },
                    { label: 'Копинг', val: snap.copingStyles },
                    { label: 'Переходы', val: snap.modeTransitions },
                    { label: 'Проблемы', val: snap.currentProblems },
                  ].filter((f) => f.val);
                  return (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(var(--fg-rgb),0.03)',
                        border: '1px solid rgba(var(--fg-rgb),0.06)',
                        borderRadius: 14,
                        padding: '12px 14px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-sub)',
                          }}
                        >
                          {fmtDate(snap.savedAt.slice(0, 10))}
                        </span>
                        <button
                          onClick={() => {
                            setLocalConcept({
                              schemaIds: snap.schemaIds ?? [],
                              modeIds: snap.modeIds ?? [],
                              earlyExperience: snap.earlyExperience ?? '',
                              unmetNeeds: snap.unmetNeeds ?? '',
                              triggers: snap.triggers ?? '',
                              copingStyles: snap.copingStyles ?? '',
                              goals: snap.goals ?? '',
                              currentProblems: snap.currentProblems ?? '',
                              modeTransitions: snap.modeTransitions ?? '',
                            });
                            setConceptDirty(true);
                            setShowHistory(false);
                          }}
                          style={{
                            fontSize: 11,
                            color: 'var(--accent)',
                            background:
                              'color-mix(in srgb, var(--accent) 10%, transparent)',
                            border: 'none',
                            borderRadius: 8,
                            padding: '4px 10px',
                            cursor: 'pointer',
                          }}
                        >
                          Восстановить
                        </button>
                      </div>
                      {snapSchemas.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            marginBottom: 6,
                          }}
                        >
                          {snapSchemas.map(({ schema, color }) => (
                            <span
                              key={schema.id}
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 20,
                                background: color + '20',
                                color,
                              }}
                            >
                              {schema.emoji} {schema.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {(snap.modeIds ?? []).length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                          {MODE_GROUPS.map((group) => {
                            const gm = group.items.filter((m) =>
                              (snap.modeIds ?? []).includes(m.id),
                            );
                            if (gm.length === 0) return null;
                            return (
                              <div
                                key={group.id}
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 4,
                                  marginBottom: 3,
                                }}
                              >
                                {gm.map((m) => (
                                  <span
                                    key={m.id}
                                    style={{
                                      fontSize: 11,
                                      padding: '2px 8px',
                                      borderRadius: 20,
                                      background: group.color + '20',
                                      color: group.color,
                                    }}
                                  >
                                    {m.emoji} {m.name}
                                  </span>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {textFields.map(({ label, val }) => (
                        <div
                          key={label}
                          style={{
                            fontSize: 12,
                            color: 'var(--text-sub)',
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              color: 'var(--text-faint)',
                              fontWeight: 600,
                            }}
                          >
                            {label}:{' '}
                          </span>
                          {(val ?? '').slice(0, 140)}
                          {(val ?? '').length > 140 ? '...' : ''}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        {selectedClient.telegramId > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={handleRequestYsq}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid rgba(96,165,250,0.2)',
                background: 'rgba(96,165,250,0.06)',
                color: ysqRequested ? '#06d6a0' : 'rgba(96,165,250,0.8)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {ysqRequested
                ? '✓ Запрос отправлен'
                : '📋 Запросить тест на схемы'}
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
        {(clientData?.ysqHistory?.length ?? 0) > 0 &&
          (() => {
            const hist = clientData!.ysqHistory;
            const latest = hist[0];
            const prev = hist[1] ?? null;
            const activeScores = latest.scores
              .filter((s) => s.pct5plus > 50)
              .sort((a, b) => b.pct5plus - a.pct5plus);
            const inactiveScores = latest.scores
              .filter((s) => s.pct5plus <= 50)
              .sort((a, b) => b.pct5plus - a.pct5plus);
            const latestDate = new Date(latest.completedAt).toLocaleDateString(
              'ru-RU',
              {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              },
            );
            const getDelta = (id: string) => {
              if (!prev) return null;
              const p = prev.scores.find((s) => s.id === id);
              if (p == null) return null;
              const d =
                (latest.scores.find((s) => s.id === id)?.pct5plus ?? 0) -
                p.pct5plus;
              return Math.abs(d) >= 5 ? d : null;
            };
            return (
              <div
                style={{
                  background: 'rgba(79,163,247,0.07)',
                  border: '1px solid rgba(79,163,247,0.2)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    color: 'rgba(79,163,247,0.8)',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  📊 Схемы · {hist.length}{' '}
                  {hist.length === 1
                    ? 'прохождение'
                    : hist.length < 5
                      ? 'прохождения'
                      : 'прохождений'}{' '}
                  · {latestDate}
                </div>

                {/* Active schemas */}
                {activeScores.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(79,163,247,0.7)',
                        marginBottom: 6,
                      }}
                    >
                      Выраженные ({activeScores.length})
                    </div>
                    {activeScores.map((score) => {
                      const meta = SCHEMA_DOMAINS.flatMap(
                        (d) => d.schemas,
                      ).find((s) => s.id === score.id);
                      const delta = getDelta(score.id);
                      return (
                        <div key={score.id} style={{ marginBottom: 6 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 3,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: 'var(--text)',
                                fontWeight: 500,
                              }}
                            >
                              {meta?.emoji} {meta?.name ?? score.id}
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                gap: 5,
                                alignItems: 'center',
                              }}
                            >
                              {delta !== null && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color:
                                      delta < 0
                                        ? 'var(--accent-green)'
                                        : 'var(--accent-red)',
                                  }}
                                >
                                  {delta > 0 ? '+' : ''}
                                  {delta}%
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: 'rgba(79,163,247,0.9)',
                                }}
                              >
                                {score.pct5plus}%
                              </span>
                            </div>
                          </div>
                          <div
                            style={{
                              height: 3,
                              background: 'rgba(79,163,247,0.1)',
                              borderRadius: 2,
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${score.pct5plus}%`,
                                background: 'rgba(79,163,247,0.6)',
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inactive schemas — compact */}
                {inactiveScores.length > 0 && (
                  <div style={{ marginBottom: hist.length >= 2 ? 10 : 0 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-faint)',
                        marginBottom: 6,
                      }}
                    >
                      Остальные
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {inactiveScores.map((score) => {
                        const meta = SCHEMA_DOMAINS.flatMap(
                          (d) => d.schemas,
                        ).find((s) => s.id === score.id);
                        const isNearBorder = score.pct5plus >= 30;
                        return (
                          <span
                            key={score.id}
                            style={{
                              fontSize: 10,
                              padding: '2px 7px',
                              borderRadius: 12,
                              background: 'rgba(var(--fg-rgb),0.05)',
                              color: isNearBorder
                                ? 'var(--text-sub)'
                                : 'var(--text-faint)',
                            }}
                          >
                            {meta?.name ?? score.id} {score.pct5plus}%
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* History timeline */}
                {hist.length >= 2 && (
                  <div
                    style={{
                      borderTop: '1px solid rgba(79,163,247,0.15)',
                      paddingTop: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(79,163,247,0.6)',
                        marginBottom: 6,
                      }}
                    >
                      История
                    </div>
                    {hist.map((entry, idx) => {
                      const entryActive = entry.scores.filter(
                        (s) => s.pct5plus > 50,
                      ).length;
                      const prevItem = hist[idx + 1];
                      const entryDelta = prevItem
                        ? entryActive -
                          prevItem.scores.filter((s) => s.pct5plus > 50).length
                        : null;
                      const d = new Date(entry.completedAt).toLocaleDateString(
                        'ru-RU',
                        {
                          day: 'numeric',
                          month: 'short',
                        },
                      );
                      return (
                        <div
                          key={entry.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background:
                                idx === 0
                                  ? 'rgba(79,163,247,0.8)'
                                  : 'rgba(79,163,247,0.25)',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              color:
                                idx === 0
                                  ? 'var(--text-sub)'
                                  : 'var(--text-faint)',
                              flex: 1,
                            }}
                          >
                            {entryActive} схем {idx === 0 ? '· сейчас' : ''}
                          </span>
                          {entryDelta !== null && entryDelta !== 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color:
                                  entryDelta < 0
                                    ? 'var(--accent-green)'
                                    : 'var(--accent-red)',
                              }}
                            >
                              {entryDelta > 0 ? '+' : ''}
                              {entryDelta}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-faint)',
                            }}
                          >
                            {d}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
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
                const schema = SCHEMA_DOMAINS.flatMap((d) => d.schemas).find(
                  (s) => s.id === id,
                );
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
                    {schema.emoji} {schema.name}
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
                    {schema.emoji} {schema.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6 }}>
          <SectionLabel mb={8}>Карта режимов</SectionLabel>
        </div>
        {MODE_GROUPS.map((group) => (
          <div key={group.id} style={{ marginBottom: 8 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.07em',
                color: group.color + 'aa',
                textTransform: 'uppercase',
                marginBottom: 5,
                paddingLeft: 2,
              }}
            >
              {group.group}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {group.items.map((mode) => {
                const active = activeModeIds.includes(mode.id);
                return (
                  <button
                    key={mode.id}
                    onClick={() => toggleModeId(mode.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 20,
                      border: 'none',
                      cursor: 'pointer',
                      background: active
                        ? group.color + '30'
                        : 'rgba(var(--fg-rgb),0.05)',
                      color: active ? group.color : 'rgba(var(--fg-rgb),0.45)',
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {mode.emoji} {mode.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
