import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { fmtDate } from '../../utils/format';
import type { ClientData, TherapyClientSummary } from '../../api';

interface Props {
  clientData: ClientData | null;
  selectedClient: TherapyClientSummary;
  selfSchemaIds: string[];
  ysqSchemaIds: string[];
  ysqRequested: boolean;
  ysqError: string;
  exportCopied: boolean;
  handleRequestYsq: () => void;
  handleExport: () => void;
}

export function ClientYSQTab({ clientData, selectedClient, selfSchemaIds, ysqRequested, ysqError, exportCopied, handleRequestYsq, handleExport }: Props) {
  if (!clientData?.ysqHistory || clientData.ysqHistory.length === 0) {
    return (
      <div className="page-inner-wide" style={{ paddingTop: 40 }}>
        <div style={{ padding: '80px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, color: 'var(--text-sub)', marginBottom: 8 }}>YSQ ещё не проходился</div>
          {selectedClient.telegramId < 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Клиент без Telegram — YSQ недоступен</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 24 }}>Запроси тест — клиент получит уведомление в боте</div>
              <button onClick={handleRequestYsq} disabled={ysqRequested} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {ysqRequested ? '✓ Запрос отправлен' : 'Запросить тест YSQ'}
              </button>
              {ysqError && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--c-rose)' }}>{ysqError}</div>}
            </>
          )}
          {selfSchemaIds.length > 0 && (
            <div style={{ marginTop: 48, textAlign: 'left', maxWidth: 640, margin: '48px auto 0' }}>
              <div className="eyebrow" style={{ marginBottom: 16 }}>Схемы, отмеченные клиентом самостоятельно</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selfSchemaIds.map(id => {
                  const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                  const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === id));
                  return (
                    <div key={id} className="tag-mini">
                      <span className="swatch" style={{ background: domain?.color ?? 'var(--accent)' }} />
                      {s?.name ?? id}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const hist = clientData.ysqHistory;
  const latest = hist[0];
  const prev = hist[1] ?? null;
  const chronHist = hist.slice().reverse();
  const top5 = latest.scores.slice().sort((a, b) => b.pct5plus - a.pct5plus).slice(0, 5);
  const top5Ids = new Set(top5.map(s => s.id));
  const allSorted = latest.scores.slice().sort((a, b) => b.pct5plus - a.pct5plus);

  const CL = 44, CR = 780, CT = 14, CB = 192, CW = CR - CL, CH = CB - CT;
  const xOf = (i: number) => CL + (chronHist.length > 1 ? (i / (chronHist.length - 1)) * CW : CW / 2);
  const yOf = (pct: number) => CB - (pct / 100) * CH;

  return (
    <div className="page-inner-wide" style={{ paddingTop: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', margin: 0 }}>YSQ</h2>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6 }}>
            {hist.length} {hist.length === 1 ? 'прохождение' : hist.length < 5 ? 'прохождения' : 'прохождений'} · последнее {clientData.ysqCompletedAt ? fmtDate(clientData.ysqCompletedAt.slice(0, 10)) : '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>
            {exportCopied ? '✓ Скопировано' : 'Экспорт'}
          </button>
          {selectedClient.telegramId >= 0 && (
            <button onClick={handleRequestYsq} disabled={ysqRequested} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {ysqRequested ? '✓ Запрос отправлен' : 'Запросить повтор'}
            </button>
          )}
        </div>
      </div>
      {ysqError && <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--c-rose)' }}>{ysqError}</div>}

      {/* Dynamics chart — only if ≥2 runs */}
      {chronHist.length >= 2 && (
        <div style={{ marginBottom: 48 }}>
          <div className="eyebrow" style={{ marginBottom: 20 }}>Динамика топ-5 схем</div>
          <svg viewBox="0 0 820 230" style={{ width: '100%', overflow: 'visible', display: 'block' }}>
            {[0, 25, 50, 75, 100].map(v => (
              <g key={v}>
                <line x1={CL} x2={CR} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" strokeWidth={1} />
                <text x={CL - 8} y={yOf(v) + 4} fontSize={10} fill="var(--text-faint)" textAnchor="end">{v}</text>
              </g>
            ))}
            {chronHist.map((run, i) => (
              <text key={i} x={xOf(i)} y={CB + 18} fontSize={10} fill="var(--text-faint)" textAnchor="middle">
                {fmtDate(run.completedAt.slice(0, 10))}
              </text>
            ))}
            {top5.map(({ id }) => {
              const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === id));
              const color = domain?.color ?? 'var(--accent)';
              const points = chronHist.map((run, i) => {
                const sc = run.scores.find(s => s.id === id);
                return sc ? `${xOf(i)},${yOf(sc.pct5plus)}` : null;
              }).filter(Boolean).join(' ');
              const lastRun = chronHist[chronHist.length - 1];
              const lastScore = lastRun.scores.find(s => s.id === id);
              return (
                <g key={id}>
                  <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" opacity={0.75} />
                  {lastScore && <circle cx={xOf(chronHist.length - 1)} cy={yOf(lastScore.pct5plus)} r={4} fill={color} />}
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 12 }}>
            {top5.map(({ id }) => {
              const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
              const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === id));
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: domain?.color ?? 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>{s?.name ?? id}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All scales table */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Все шкалы</div>
        <div style={{ display: 'grid', gridTemplateColumns: `1fr repeat(${prev ? 3 : 1}, 80px)`, gap: '0 8px', marginBottom: 8 }}>
          <span className="eyebrow">Схема</span>
          <span className="eyebrow" style={{ textAlign: 'right' }}>{fmtDate(latest.completedAt.slice(0, 10))}</span>
          {prev && <span className="eyebrow" style={{ textAlign: 'right' }}>{fmtDate(prev.completedAt.slice(0, 10))}</span>}
          {prev && <span className="eyebrow" style={{ textAlign: 'right' }}>Δ</span>}
        </div>
        {allSorted.map(score => {
          const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === score.id);
          const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === score.id));
          const prevScore = prev?.scores.find(x => x.id === score.id);
          const delta = prevScore != null ? score.pct5plus - prevScore.pct5plus : null;
          const isTop5 = top5Ids.has(score.id);
          return (
            <div key={score.id} style={{ display: 'grid', gridTemplateColumns: `1fr repeat(${prev ? 3 : 1}, 80px)`, gap: '0 8px', padding: '11px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 3, height: 18, borderRadius: 2, background: domain?.color ?? 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: isTop5 ? 600 : 400, color: isTop5 ? 'var(--text)' : 'var(--text-sub)' }}>{s?.name ?? score.id}</span>
              </div>
              <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: score.pct5plus > 65 ? 'var(--c-rose)' : score.pct5plus > 50 ? 'var(--c-clay)' : 'var(--text-sub)' }}>
                {score.pct5plus}%
              </span>
              {prev && <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-faint)' }}>{prevScore != null ? `${prevScore.pct5plus}%` : '—'}</span>}
              {prev && (
                <span style={{ textAlign: 'right', fontSize: 13, fontWeight: delta != null && delta !== 0 ? 500 : 400, color: delta == null || delta === 0 ? 'var(--text-faint)' : delta < 0 ? 'var(--c-moss)' : 'var(--c-rose)' }}>
                  {delta == null ? '—' : delta === 0 ? '0' : `${delta > 0 ? '+' : ''}${delta}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
