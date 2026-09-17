import { useState, lazy, Suspense } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from '../utils/storageKeys';
import { TherapyNote } from './TherapyNote';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { useTr } from '../utils/addressForm';
import { NEED_ORDER } from '../needData';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
import { buildNeedsData } from './schemaInfoSheet/data';
import { ModesTab } from './schemaInfoSheet/ModesTab';

const YSQTestSheet = lazy(() => import('./YSQTestSheet').then(m => ({ default: m.YSQTestSheet })));

type Tab = 'needs' | 'schemas' | 'modes';

/* ─── Sub-components ─── */
function NeedsTab() {
  const tr = useTr();
  const NEEDS_DATA = buildNeedsData(tr);
  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 24 }}>
        Схема-терапия строится на идее, что у каждого есть пять базовых эмоциональных потребностей. Когда они систематически не удовлетворялись в детстве – формируются схемы.
      </p>
      {NEEDS_DATA.map((n, i) => (
        <div key={n.title} style={{ borderBottom: '1px solid var(--line)', padding: '20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-14)', marginBottom: 10 }}>
            <IdentityDot id={NEED_ORDER[i]} size={16} />
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--text)' }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>{n.subtitle}</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65, margin: 0 }}>{n.desc}</p>
        </div>
      ))}
    </div>
  );
}

function hexToRgbStr(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function SchemasTab({ highlight }: { highlight?: string }) {
  const initialDomain = highlight
    ? SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.name === highlight))?.domain ?? null
    : null;
  const [open, setOpen] = useState<string | null>(initialDomain);

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 24 }}>
        20 ранних дезадаптивных схем сгруппированы в 5 доменов. Схема – не диагноз, а паттерн, который когда-то помогал выжить.
      </p>
      {SCHEMA_DOMAINS.map((d) => (
        <div key={d.domain} style={{ marginBottom: 10 }}>
          <div
            onClick={() => setOpen(open === d.domain ? null : d.domain)}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open === d.domain ? null : d.domain); } }}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 18px',
              background: 'rgba(var(--fg-rgb),0.04)', borderRadius: open === d.domain ? '14px 14px 0 0' : 14,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--text)' }}>{d.domain}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {d.schemas.length}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ transform: open === d.domain ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          {open === d.domain && (
            <div style={{ background: 'rgba(var(--fg-rgb),0.03)', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
              {d.schemas.map((s, i) => {
                const isHighlighted = s.name === highlight;
                return (
                  <div key={s.name} style={{ padding: '14px 18px', borderTop: i > 0 ? '1px solid rgba(var(--fg-rgb),0.05)' : 'none', background: isHighlighted ? `rgba(${hexToRgbStr(d.color)},0.12)` : 'transparent' }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: d.color, marginBottom: 4 }}>{s.name}{isHighlighted && ' ◀'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>{(s as { libraryDesc?: string; desc: string }).libraryDesc ?? s.desc}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


const SCHEMA_TABS: { key: Tab; label: string }[] = [
  { key: 'needs',   label: 'Потребности' },
  { key: 'schemas', label: 'Схемы' },
  { key: 'modes',   label: 'Режимы' },
];

export function SchemaInfoContent({ initialTab, highlight }: { initialTab?: Tab; highlight?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'needs');
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--line)' }}>
        {SCHEMA_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 14,
                color: active ? 'var(--text)' : 'var(--text-sub)',
                fontWeight: active ? 600 : 400,
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >{t.label}</button>
          );
        })}
      </div>
      {tab === 'needs'   && <NeedsTab />}
      {tab === 'schemas' && <SchemasTab highlight={highlight} />}
      {tab === 'modes'   && <ModesTab />}
      <div style={{ marginTop: 32 }}>
        <TherapyNote />
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export type SchemaInfoTab = 'needs' | 'schemas' | 'modes';
interface Props { onClose: () => void; ratings?: Record<string, number>; autoStartTest?: boolean; initialTab?: SchemaInfoTab; highlightSchema?: string }

export function SchemaInfoSheet({ onClose, ratings, autoStartTest, initialTab, highlightSchema: initHighlight }: Props) {
  const goBack = useHistorySheet(onClose); const tr = useTr();
  const [showTest, setShowTest] = useState(autoStartTest ?? false);
  const [contentKey, setContentKey] = useState(0);
  const [contentInitialTab, setContentInitialTab] = useState<Tab>(initialTab ?? 'needs');
  const hasResult   = !!localStorage.getItem(YSQ_RESULT_KEY);
  const hasProgress = !!localStorage.getItem(YSQ_PROGRESS_KEY);
  const [highlightSchema, setHighlightSchema] = useState<string | undefined>(initHighlight);

  const handleViewSchemas = (schemaName?: string) => {
    setContentInitialTab('schemas');
    setHighlightSchema(schemaName);
    setContentKey(k => k + 1);
    setShowTest(false);
  };

  return (
    <div className="ex-screen" style={{ zIndex: 80 }}>
      <div className="ex-topbar">
        <button className="ex-back" onClick={goBack}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div className="page">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>Схема-терапия</div>
          <h1 className="hub-title">Как это <span className="it">работает</span></h1>
        </div>

        <SchemaInfoContent key={contentKey} initialTab={contentInitialTab} highlight={highlightSchema} />

        <div style={{ marginTop: 32, paddingTop: 28, borderTop: '1px solid var(--line)' }}>
          {hasProgress && !hasResult && (
            <div
              onClick={() => setShowTest(true)}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTest(true); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-14)',
                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 'var(--r-16)', padding: '16px 20px', marginBottom: 12, cursor: 'pointer',
              }}>
              <span style={{ fontSize: 22 }}>⏸</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--accent-yellow)' }}>Незаконченный тест</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>{tr('Нажми, чтобы продолжить с места остановки', 'Нажмите, чтобы продолжить с места остановки')}</div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--accent-yellow)' }}>›</span>
            </div>
          )}
          <div
            onClick={() => setShowTest(true)}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTest(true); } }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
              borderRadius: 'var(--r-16)', padding: '18px 20px', cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--accent)' }}>
                {hasResult ? 'Мои результаты теста' : hasProgress ? 'Продолжить тест' : 'Пройти тест на схемы'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
                {hasResult ? 'Посмотреть или пройти заново' : '116 вопросов · ~10 минут'}
              </div>
            </div>
            <span style={{ fontSize: 22, color: 'var(--accent)' }}>›</span>
          </div>
        </div>
      </div>

      </div> {/* .page */}

      {showTest && (
        <Suspense fallback={null}>
          <YSQTestSheet
            onClose={() => setShowTest(false)}
            ratings={ratings}
            autoResume={autoStartTest}
            onViewSchemas={(name) => handleViewSchemas(name)}
          />
        </Suspense>
      )}
    </div>
  );
}
