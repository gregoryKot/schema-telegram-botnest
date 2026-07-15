import { useTr } from '../utils/addressForm';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { getTherapistContact } from '../utils/therapistContact';
import { api } from '../api';
import {
  useYsqTest,
  QUESTIONS,
  NEED_LABELS,
  TOTAL_PAGES,
  ANSWER_LABELS,
  TIP_VY,
  getSchemaForQuestion,
  YSQ_RESULT_KEY,
  YSQ_PROGRESS_KEY,
} from '../hooks/useYsqTest';

export { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY };

interface Props {
  onClose: () => void;
  ratings?: Record<string, number>;
  autoResume?: boolean;
  onViewSchemas?: (schemaName: string) => void;
}

export function YSQTestSheet({ onClose, ratings, autoResume, onViewSchemas }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const {
    phase, setPhase,
    answers,
    page,
    slideKey, slideDir,
    history,
    hasProgress,
    inactiveExpanded, setInactiveExpanded,
    retakeConfirm, setRetakeConfirm,
    progressAnswered,
    handleContinue,
    handleStartFresh,
    selectAnswer,
    handleBack,
    handleRetake,
    scores,
    resultView,
  } = useYsqTest({ api, autoResume });

  // ── Full-screen test phase ────────────────────────────────────────────────────
  if (phase === 'test') {
    const qIdx = page;
    const currentAnswer = answers[qIdx];
    const schema = getSchemaForQuestion(qIdx);
    const progressPct = ((page + 1) / TOTAL_PAGES) * 100;

    return (
      <>
        <style>{`
          @keyframes slideFromRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes slideFromLeft  { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
        `}</style>
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ flexShrink: 0, padding: '16px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button
                onClick={handleBack}
                disabled={page === 0}
                aria-label="Назад"
                style={{ width: 36, height: 36, borderRadius: 12, border: 'none', background: page === 0 ? 'transparent' : 'rgba(var(--fg-rgb),0.08)', color: 'var(--text-sub)', fontSize: 16, cursor: page === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === 0 ? 0 : 1, transition: 'opacity 0.15s' }}
              >←</button>
              <span style={{ fontSize: 13, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{page + 1} / {TOTAL_PAGES}</span>
              <button
                onClick={() => setPhase('intro')}
                aria-label="Закрыть"
                style={{ width: 36, height: 36, borderRadius: 12, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--text-sub)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
            <div style={{ height: 3, background: 'rgba(var(--fg-rgb),0.08)', borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.25s ease' }} />
            </div>
          </div>

          {/* Question – animated on page change */}
          <div
            key={slideKey}
            style={{
              flex: 1,
              padding: '24px 20px 16px',
              overflowY: 'auto',
              animation: `${slideDir === 'forward' ? 'slideFromRight' : 'slideFromLeft'} 0.22s cubic-bezier(0.25,0.46,0.45,0.94)`,
            }}
          >
            {schema && (
              <div className="eyebrow" style={{ color: schema.color, marginBottom: 12 }}>
                {schema.name}
              </div>
            )}
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.45 }}>
              {QUESTIONS[qIdx]}
            </div>
          </div>

          {/* Answer buttons */}
          <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            {ANSWER_LABELS.map((label, i) => {
              const value = i + 1;
              const selected = currentAnswer === value;
              return (
                <button
                  key={value}
                  onClick={() => selectAnswer(qIdx, value)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 16px', borderRadius: 16,
                    border: `1.5px solid ${selected ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.08)'}`,
                    background: selected ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? 'var(--text)' : 'rgba(var(--fg-rgb),0.2)'}`,
                    background: selected ? 'var(--text)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.12s',
                  }}>
                    {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 15, color: selected ? 'var(--text)' : 'var(--text-sub)', fontWeight: selected ? 500 : 400 }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ── Intro + Result ────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <div className="ex-topbar">
        <button className="ex-back" onClick={goBack}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div className="page">
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px 80px' }}>
      {/* INTRO */}
      {phase === 'intro' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🧠</div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 8, lineHeight: 1.2 }}>
              Тест на схеме
            </h1>
            <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.5 }}>
              Паттерны мышления и поведения, сложившиеся в детстве
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              ['📋', '116 утверждений', 'Оцени каждое от 1 до 6'],
              ['⏱️', '~10 минут', 'Можно прервать – прогресс сохраняется'],
              ['🔍', '20 схем', 'Результат с описанием и советом для каждой'],
            ].map(([emoji, title, desc]) => (
              <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 14, padding: '12px 16px' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 1 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(var(--fg-rgb),0.05)', borderRadius: 14, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', fontWeight: 600, marginBottom: 10 }}>Шкала ответов:</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
              {[1,2,3,4,5,6].map(n => (
                <div key={n} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{
                    height: 34, borderRadius: 10,
                    background: `color-mix(in srgb, var(--accent) ${6 + n * 13}%, rgba(var(--fg-rgb),0.06))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700,
                    color: n >= 4 ? 'var(--accent)' : 'var(--text-sub)',
                    marginBottom: 5,
                  }}>{n}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-faint)', lineHeight: 1.3 }}>
                    {n === 1 ? 'Совсем не про меня' : n === 6 ? 'Полностью про меня' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5, marginBottom: 20, textAlign: 'center' }}>
            Ответы привязаны к аккаунту Telegram и не передаются третьим лицам.
          </div>

          {hasProgress ? (
            <>
              <button onClick={handleContinue} className="ex-btn ex-btn-primary" style={{ marginBottom: 10 }}>
                Продолжить ({progressAnswered} из 116)
              </button>
              <button onClick={handleStartFresh} style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 14, background: 'rgba(var(--fg-rgb),0.07)', color: 'var(--text-sub)', fontSize: 15, fontWeight: 500, cursor: 'pointer', marginBottom: 10 }}>
                Начать заново
              </button>
            </>
          ) : (
            <button onClick={handleStartFresh} className="ex-btn ex-btn-primary" style={{ marginBottom: 10 }}>
              Начать тест
            </button>
          )}

          <button onClick={goBack} style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 14, background: 'rgba(var(--fg-rgb),0.07)', color: 'var(--text-sub)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
            Отмена
          </button>

          <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.7, textAlign: 'center' }}>
            Самостоятельный опросник для самонаблюдения по модели ранних дезадаптивных схем. Это не диагностический инструмент и не заменяет консультацию специалиста.
          </div>
        </div>
      )}

      {/* RESULT */}
      {phase === 'result' && scores && resultView && (() => {
        const { inactiveSchemas, activeByDomain, dateLabel, activeCount, activeLabel, getSchemaDelta } = resultView;

        return (
          <div>
            {/* Header */}
            <div style={{ marginBottom: 16 }}>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, color: 'var(--text)', marginBottom: 4, lineHeight: 1.2 }}>
                {activeLabel}
              </h1>
              {dateLabel && (
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Пройдено {dateLabel}</div>
              )}
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55, marginBottom: 20, fontStyle: 'italic' }}>
              Схема считается выраженной если больше половины ответов – 5 или 6. Это инструмент самоисследования, не диагноз.
            </div>

            {activeCount === 0 && (
              <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 14, color: 'var(--text-sub)' }}>
                Выраженных схем не обнаружено – отличный результат.
              </div>
            )}

            {/* Active schemas grouped by domain */}
            {activeByDomain.map(domain => (
              <div key={domain.needId} style={{ marginBottom: 20 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  {domain.label}
                </div>
                {domain.schemas.map(schema => {
                  const s = scores[schema.name];
                  const color = schema.color;
                  const diaryRating = ratings?.[schema.needId];
                  const showDiaryHint = diaryRating !== undefined && diaryRating <= 4;
                  const delta = getSchemaDelta(schema.name);
                  return (
                    <div key={schema.name} style={{
                      marginBottom: 10,
                      background: `color-mix(in srgb, ${color} 10%, transparent)`,
                      borderRadius: 16,
                      padding: '14px 16px',
                      border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 3 }} />
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.35 }}>{schema.name}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {delta !== null && Math.abs(delta) >= 5 && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: delta < 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {delta > 0 ? '+' : ''}{delta}%
                            </span>
                          )}
                          <div style={{ fontSize: 15, fontWeight: 700, color }}>{s.pct5plus}%</div>
                        </div>
                      </div>

                      <div style={{ height: 3, background: 'rgba(var(--fg-rgb),0.1)', borderRadius: 2, marginBottom: 10 }}>
                        <div style={{ height: '100%', width: `${s.pct5plus}%`, background: color, borderRadius: 2 }} />
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55, marginBottom: 8 }}>
                        {schema.desc}
                      </div>

                      <div style={{ display: 'flex', gap: 8, background: 'rgba(var(--fg-rgb),0.05)', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                        <span style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>{tr(schema.tip, TIP_VY[schema.name] ?? schema.tip)}</span>
                      </div>

                      <div
                        onClick={() => onViewSchemas ? onViewSchemas(schema.name) : goBack()}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 0', marginBottom: showDiaryHint ? 8 : 0 }}
                      >
                        <span style={{ fontSize: 13, color: 'var(--accent)' }}>Читать карточку схемы</span>
                        <span style={{ fontSize: 16, color: 'var(--accent)' }}>›</span>
                      </div>

                      {showDiaryHint && (
                        <div style={{ fontSize: 12, color: 'var(--accent-yellow)', lineHeight: 1.4, padding: '6px 10px', background: 'rgba(250,204,21,0.1)', borderRadius: 8 }}>
                          ⚡ Совпадает с дневником: «{NEED_LABELS[schema.needId]}» стабильно низкая
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Inactive schemas – collapsed */}
            {inactiveSchemas.length > 0 && (
              <div style={{ marginTop: 4, marginBottom: 12 }}>
                <button
                  onClick={() => setInactiveExpanded(prev => !prev)}
                  style={{
                    width: '100%', padding: '11px 16px', border: 'none', borderRadius: 12,
                    background: 'rgba(var(--fg-rgb),0.05)', color: 'var(--text-sub)',
                    fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>Остальные схемы ({inactiveSchemas.length})</span>
                  <span style={{ fontSize: 12 }}>{inactiveExpanded ? '▲' : '▼'}</span>
                </button>
                {inactiveExpanded && (
                  <div style={{ marginTop: 8 }}>
                    {inactiveSchemas.map(schema => {
                      const s = scores[schema.name];
                      const mid = s.pct5plus >= 30 && s.pct5plus <= 50;
                      const barColor = mid ? 'var(--accent-yellow)' : 'rgba(var(--fg-rgb),0.2)';
                      return (
                        <div key={schema.name} style={{ marginBottom: 8, background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 12, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                            <div style={{ fontSize: 13, color: 'var(--text-sub)', flex: 1, paddingRight: 8, lineHeight: 1.3 }}>{schema.name}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: barColor, flexShrink: 0 }}>{s.pct5plus}%</div>
                          </div>
                          <div style={{ height: 3, background: 'rgba(var(--fg-rgb),0.1)', borderRadius: 2 }}>
                            <div style={{ height: '100%', width: `${s.pct5plus}%`, background: barColor, borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            {activeCount > 0 && (
              <div style={{
                marginTop: 8, marginBottom: 16,
                background: 'color-mix(in srgb, var(--accent) 7%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                borderRadius: 16, padding: '16px 18px',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
                  {tr('Хочешь разобраться глубже?', 'Хотите разобраться глубже?')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.65, marginBottom: 12 }}>
                  Схемы – паттерны, сложившиеся давно. Их можно менять, но это требует времени и поддержки. Схема-терапия – один из самых эффективных методов для этой работы.
                </div>
                <a
                  href={getTherapistContact().url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', padding: '11px 0', borderRadius: 12, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
                >
                  {getTherapistContact().name === 'автору' ? 'Поговорить с психологом →' : `Написать ${getTherapistContact().name} →`}
                </a>
              </div>
            )}

            {/* History timeline */}
            {history.length >= 2 && (
              <div style={{ marginBottom: 20 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  История прохождений
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map((entry, idx) => {
                    const entryActive = entry.scores.filter(s => s.pct5plus > 50).length;
                    const prevEntryItem = history[idx + 1];
                    const entryDelta = prevEntryItem
                      ? entryActive - prevEntryItem.scores.filter(s => s.pct5plus > 50).length
                      : null;
                    const entryDate = new Date(entry.completedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
                    return (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: idx === 0 ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.2)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: idx === 0 ? 'var(--text)' : 'var(--text-sub)', fontWeight: idx === 0 ? 600 : 400 }}>
                            {entryActive} {entryActive === 1 ? 'схема' : entryActive < 5 ? 'схемы' : 'схем'}
                            {idx === 0 && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 6 }}>сейчас</span>}
                          </div>
                        </div>
                        {entryDelta !== null && Math.abs(entryDelta) > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: entryDelta < 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {entryDelta > 0 ? '+' : ''}{entryDelta}
                          </span>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{entryDate}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={goBack} className="ex-btn ex-btn-primary" style={{ marginTop: 4, marginBottom: 10 }}>
              Сохранить и закрыть
            </button>

            {retakeConfirm ? (
              <div style={{ background: 'rgba(255,100,100,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 12 }}>Результаты будут удалены. Точно начать заново?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setRetakeConfirm(false)} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer' }}>Отмена</button>
                  <button onClick={handleRetake} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: 'rgba(255,100,100,0.2)', color: 'var(--accent-red)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Начать заново</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setRetakeConfirm(true)} style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 14, background: 'rgba(var(--fg-rgb),0.07)', color: 'var(--text-sub)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                Пройти заново
              </button>
            )}

            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.7, textAlign: 'center' }}>
              Самостоятельный опросник для самонаблюдения по модели ранних дезадаптивных схем. Не диагностический инструмент и не заменяет консультацию специалиста.
            </div>
          </div>
        );
      })()}
      </div>
      </div> {/* .page */}
    </div>
  );
}
