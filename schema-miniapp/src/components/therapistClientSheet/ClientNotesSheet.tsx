import { BottomSheet } from '../BottomSheet';
import { SCHEMA_DOMAINS, getModeById } from '../../schemaTherapyData';
import type { ClientDetail } from './types';

interface Props {
  detail: ClientDetail;
}

export function ClientNotesSheet({ detail }: Props) {
  const {
    setShowClientNotesSheet,
    clientSchemaNotesData,
    clientModeNotesData,
  } = detail;

  return (
    <BottomSheet onClose={() => setShowClientNotesSheet(false)}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 20,
          }}
        >
          📖 Записи клиента
        </div>
        {clientSchemaNotesData.length === 0 &&
        clientModeNotesData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-sub)',
                lineHeight: 1.6,
              }}
            >
              Клиент ещё не заполнил карточки схем или режимов
            </div>
          </div>
        ) : (
          <>
            {clientSchemaNotesData.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                    marginBottom: 10,
                  }}
                >
                  Схемы · {clientSchemaNotesData.length}
                </div>
                {clientSchemaNotesData.map((n) => {
                  const s = SCHEMA_DOMAINS.flatMap((d) =>
                    d.schemas.map((x) => ({ ...x, color: d.color })),
                  ).find((x) => x.id === n.schemaId);
                  const filled = [
                    n.triggers,
                    n.feelings,
                    n.thoughts,
                    n.origins,
                    n.reality,
                    n.healthyView,
                    n.behavior,
                  ].filter(Boolean);
                  return (
                    <div
                      key={n.schemaId}
                      style={{
                        background: 'rgba(var(--fg-rgb),0.03)',
                        border: '1px solid rgba(var(--fg-rgb),0.07)',
                        borderRadius: 12,
                        padding: '12px 14px',
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text)',
                          marginBottom: 8,
                        }}
                      >
                        {s?.emoji ?? '●'} {s?.name ?? n.schemaId}
                      </div>
                      {[
                        { label: 'Триггеры', val: n.triggers },
                        { label: 'Чувства', val: n.feelings },
                        { label: 'Мысли', val: n.thoughts },
                        { label: 'Корни', val: n.origins },
                        { label: 'Реальность', val: n.reality },
                        { label: 'Здоровый взгляд', val: n.healthyView },
                        { label: 'Поведение', val: n.behavior },
                      ]
                        .filter((f) => f.val?.trim())
                        .map((f) => (
                          <div key={f.label} style={{ marginBottom: 6 }}>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--text-faint)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.07em',
                                marginBottom: 2,
                              }}
                            >
                              {f.label}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: 'var(--text-sub)',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {f.val}
                            </div>
                          </div>
                        ))}
                      {filled.length === 0 && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-faint)',
                          }}
                        >
                          Не заполнено
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {clientModeNotesData.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                    marginBottom: 10,
                  }}
                >
                  Режимы · {clientModeNotesData.length}
                </div>
                {clientModeNotesData.map((n) => {
                  const m = getModeById(n.modeId);
                  return (
                    <div
                      key={n.modeId}
                      style={{
                        background: 'rgba(var(--fg-rgb),0.03)',
                        border: '1px solid rgba(var(--fg-rgb),0.07)',
                        borderRadius: 12,
                        padding: '12px 14px',
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text)',
                          marginBottom: 8,
                        }}
                      >
                        {m?.emoji ?? '🔄'} {m?.name ?? n.modeId}
                      </div>
                      {[
                        { label: 'Триггеры', val: n.triggers },
                        { label: 'Чувства', val: n.feelings },
                        { label: 'Мысли', val: n.thoughts },
                        { label: 'Потребности', val: n.needs },
                        { label: 'Поведение', val: n.behavior },
                      ]
                        .filter((f) => f.val?.trim())
                        .map((f) => (
                          <div key={f.label} style={{ marginBottom: 6 }}>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--text-faint)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.07em',
                                marginBottom: 2,
                              }}
                            >
                              {f.label}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: 'var(--text-sub)',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {f.val}
                            </div>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
