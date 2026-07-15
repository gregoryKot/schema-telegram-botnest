import { useEffect, useState, lazy, Suspense } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api } from '../api';
import { fmtDate } from '../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS, ALL_MODES } from '../schemaTherapyData';
import { useNeedData } from '../needData';
import { SchemaPickerSheet } from '../components/SchemaPickerSheet';
import { useTr } from '../utils/addressForm';
import { SchemaDetailSheet } from '../components/SchemaDetailSheet';
import { NeedDetailSheet } from '../components/NeedDetailSheet';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { GlyphArrowLeft } from '../components/exercises/ExScreen';

const ModeEx = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));
const ModeMapViewer = lazy(() => import('../components/ModeMapViewer').then(m => ({ default: m.ModeMapViewer })));

/** color-mix: works with CSS vars AND hex. Replaces the old hex-alpha hack. */
function cm(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
const NEED_IDS: { id: string; color: string }[] = [
  { id: 'attachment', color: '#ff6b9d' },
  { id: 'autonomy',   color: '#4fa3f7' },
  { id: 'expression', color: '#facc15' },
  { id: 'play',       color: '#06d6a0' },
  { id: 'limits',     color: '#a78bfa' },
];

function readLocalIds(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch { return []; }
}

function shortName(name: string): string {
  const part = name.split(' / ')[0];
  return part
    .replace('Эмоциональная ', 'Эмоц. ')
    .replace('Социальная ', 'Соц. ')
    .replace('Недостаточность ', 'Недост. ');
}

function needScoreColor(v: number) {
  if (v <= 3) return 'var(--accent-red)';
  if (v <= 6) return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

interface Props {
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
  childhoodRatings?: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
}

export function SchemasSection({ onOpenSchema, childhoodRatings = {}, onOpenChildhoodWheel }: Props) {
  const NEED_DATA = useNeedData();
  const tr = useTr();
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() => readLocalIds(MY_SCHEMA_IDS_KEY));
  const [myModeIds, setMyModeIds]         = useState<string[]>(() => readLocalIds(MY_MODE_IDS_KEY));
  const [ysqSchemaIds, setYsqSchemaIds]   = useState<string[]>([]);
  const [ysqScores, setYsqScores]         = useState<Record<string, number>>({});
  const [profileLoading, setProfileLoading] = useState(true);
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);
  const [showModePicker, setShowModePicker]     = useState(false);
  const [introModeId, setIntroModeId]     = useState<string | null>(null);
  const [detailSchemaId, setDetailSchemaId] = useState<string | null>(null);
  const [detailNeedId, setDetailNeedId]   = useState<string | null>(null);
  const [ysqCompletedAt, setYsqCompletedAt] = useState<string | null>(null);
  const [myMapCount, setMyMapCount]       = useState(0);
  const [showMyMap, setShowMyMap]         = useState(false);

  useEffect(() => {
    Promise.all([api.getProfile(), api.getYsqHistory()]).then(([p, history]) => {
      const serverSchemas = Array.isArray(p?.mySchemaIds) ? p.mySchemaIds : [];
      const serverModes   = Array.isArray(p?.myModeIds)   ? p.myModeIds   : [];
      setManualSchemaIds(serverSchemas);
      if (serverSchemas.length > 0) localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(serverSchemas));
      setMyModeIds(serverModes);
      if (serverModes.length > 0) localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(serverModes));
      setYsqSchemaIds(Array.isArray(p?.ysq?.activeSchemaIds) ? p.ysq.activeSchemaIds : []);
      setYsqCompletedAt(p?.ysq?.completedAt ?? null);
      // Build scores map from latest YSQ history entry
      if (Array.isArray(history) && history.length > 0) {
        const latest = history[0];
        const map: Record<string, number> = {};
        if (Array.isArray(latest.scores)) {
          for (const s of latest.scores) map[s.id] = Math.round(s.pct5plus);
        }
        setYsqScores(map);
      }
      setProfileLoading(false);
    }).catch(() => setProfileLoading(false));
    api.listMyModeMaps().then(list => setMyMapCount(list.length)).catch(() => {});
  }, []);

  const allSchemaIds = [...new Set([...ysqSchemaIds, ...manualSchemaIds])];
  const myModes = myModeIds
    .map(id => ALL_MODES.find(m => m.id === id))
    .filter(Boolean) as typeof ALL_MODES;

  function saveSchemas(ids: string[]) {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(ids));
    setManualSchemaIds(ids);
    api.updateSettings({ mySchemaIds: ids }).catch(() => {});
  }

  const hasChildhood = Object.keys(childhoodRatings).length > 0;

  return (
    <div className="page-inner-wide">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            <span style={{ color: 'var(--accent)' }}>● </span>Схема-терапия
          </div>
          <h1 className="hub-title" style={{ marginBottom: 8 }}>
            Мои<br /><span className="it">паттерны</span>
          </h1>
          <p className="hub-sub" style={{ margin: 0 }}>Схемы, режимы, потребности</p>
        </div>
        <button onClick={() => onOpenSchema()} className="btn btn-secondary" style={{ marginTop: 14 }}>
          📖 <span>Библиотека</span>
        </button>
      </div>

      <div>

        {/* ══════════ ТВОИ ВЫРАЖЕННЫЕ СХЕМЫ (YSQ) ══════════ */}
        {!profileLoading && ysqSchemaIds.length > 0 && (
          <div className="section">
            <div className="section-head">
              <h3>{tr('Твои выраженные схемы', 'Ваши выраженные схемы')}</h3>
              {ysqCompletedAt && (
                <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                  Тест от {fmtDate(ysqCompletedAt.slice(0, 10))}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {ysqSchemaIds.map(sid => {
                const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === sid));
                const schema = domain?.schemas.find(s => s.id === sid);
                if (!schema || !domain) return null;
                const c = domain.color;
                const score = ysqScores[sid] ?? 0;
                return (
                  <div
                    key={sid}
                    onClick={() => setDetailSchemaId(sid)}
                    style={{
                      display: 'grid', gridTemplateColumns: '1.5fr 1fr 52px',
                      gap: 24, alignItems: 'center',
                      padding: '14px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 4, height: 22, background: c, borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{schema.name}</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(var(--fg-rgb),0.08)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${score}%`, height: '100%', background: c, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: c, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {score > 0 ? `${score}%` : '–'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════ Тест на схемы ══════════ */}
        <div className="section">
          <div className="section-head">
            <h3>Тест на схемы</h3>
            <button onClick={() => onOpenSchema({ startTest: true })} className="link">
              {ysqCompletedAt ? `пройден ${fmtDate(ysqCompletedAt.slice(0, 10))} · пройти снова →` : 'Начать →'}
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            {ysqCompletedAt ? '116 вопросов · определяет активные схемы автоматически' : 'Определи схемы автоматически – 116 вопросов, 10 минут'}
          </div>
        </div>

        {/* ══════════ МОИ СХЕМЫ ══════════ */}
        <div className="section">
          <div className="section-head">
            <h3>Мои схемы</h3>
            <button onClick={() => setShowSchemaPicker(true)} className="link">+ Добавить</button>
          </div>
          {profileLoading ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[80, 100, 90, 110].map((w, i) => (
                <div key={i} style={{ height: 32, width: w, borderRadius: 20, background: 'var(--surface-2)', animation: 'shimmer 1.5s linear infinite' }} />
              ))}
            </div>
          ) : allSchemaIds.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
              Пройди тест на схемы или добавь вручную
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allSchemaIds.map(id => {
                const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === id));
                const schema = domain?.schemas.find(s => s.id === id);
                if (!schema || !domain) return null;
                const c = domain.color;
                return (
                  <button key={id} onClick={() => setDetailSchemaId(id)} style={{
                    padding: '6px 13px', borderRadius: 20,
                    border: `1.5px solid ${cm(c, 35)}`,
                    background: cm(c, 9),
                    color: c, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                    {shortName(schema.name)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════ ПОЛНАЯ КАРТА ══════════ */}
        <div className="section">
          <div className="section-head">
            <h3>Полная карта · 20 схем</h3>
            <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>5 доменов</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {SCHEMA_DOMAINS.map(domain => {
              const c = domain.color;
              const activeCount = domain.schemas.filter(s => allSchemaIds.includes(s.id)).length;
              return (
                <div key={domain.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                    <span style={{ width: 24, height: 3, background: c, flexShrink: 0, alignSelf: 'center' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: c }}>{domain.domain}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                      {activeCount > 0 ? `${activeCount} из ${domain.schemas.length} активны` : `${domain.schemas.length} схем`}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                    {domain.schemas.map(s => {
                      const isMine = allSchemaIds.includes(s.id);
                      return (
                        <div key={s.id} onClick={() => setDetailSchemaId(s.id)} style={{
                          cursor: 'pointer', borderRadius: 10,
                          background: isMine ? cm(c, 7) : 'var(--surface-2)',
                          border: `1px solid ${isMine ? cm(c, 22) : 'var(--line)'}`,
                          borderLeft: `3px solid ${isMine ? c : 'var(--line)'}`,
                          padding: '10px 14px',
                          transition: 'all 0.15s',
                        }}>
                          <div style={{ fontSize: 13, fontWeight: isMine ? 600 : 500, color: isMine ? 'var(--text)' : 'var(--text-sub)', lineHeight: 1.25 }}>
                            {s.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.45 }}>{s.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════ МОИ РЕЖИМЫ ══════════ */}
        <div className="section">
          <div className="section-head">
            <h3>Мои режимы</h3>
            <button onClick={() => setShowModePicker(true)} className="link">+ Добавить</button>
          </div>
          {profileLoading ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[90, 110, 80].map((w, i) => (
                <div key={i} style={{ height: 32, width: w, borderRadius: 20, background: 'var(--surface-2)', animation: 'shimmer 1.5s linear infinite' }} />
              ))}
            </div>
          ) : myModes.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>Добавь режимы которые узнаёшь у себя</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {myModes.map(m => {
                const c = m.groupColor;
                return (
                  <button key={m.id} onClick={() => setIntroModeId(m.id)} style={{
                    padding: '6px 13px', borderRadius: 20,
                    border: `1.5px solid ${cm(c, 35)}`,
                    background: cm(c, 9),
                    color: c, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <span style={{ fontSize: 14 }}>{m.emoji}</span>
                    {m.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════ КАРТА РЕЖИМОВ ОТ ТЕРАПЕВТА ══════════ */}
        {myMapCount > 0 && (
          <div className="section">
            <button onClick={() => setShowMyMap(true)} style={{
              width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 14,
              border: '1px solid rgba(var(--fg-rgb),0.1)', background: 'rgba(var(--fg-rgb),0.04)',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>🗺️</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  Карта режимов с терапевтом
                </span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>
                  {myMapCount === 1 ? 'Схема того, как режимы развиваются на триггер' : `${myMapCount} карты · как режимы развиваются на триггер`}
                </span>
              </span>
              <span style={{ fontSize: 18, color: 'var(--text-faint)', flexShrink: 0 }}>→</span>
            </button>
          </div>
        )}

        {/* ══════════ ВСЕ РЕЖИМЫ (карта) ══════════ */}
        <div className="section">
          <div className="section-head">
            <h3>Карта режимов</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {MODE_GROUPS.map(group => {
              const c = group.color;
              return (
                <div key={group.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                    <span style={{ width: 20, height: 3, background: c, flexShrink: 0, alignSelf: 'center' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: c }}>{group.group}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                    {group.items.map(m => {
                      const active = myModeIds.includes(m.id);
                      return (
                        <div key={m.id} onClick={() => setIntroModeId(m.id)} style={{
                          padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                          background: active ? cm(c, 8) : 'var(--surface-2)',
                          border: `1px solid ${active ? cm(c, 28) : 'var(--line)'}`,
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          transition: 'all 0.15s',
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: active ? cm(c, 22) : cm(c, 14),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20,
                          }}>{m.emoji}</div>
                          <div style={{ paddingTop: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? c : 'var(--text)', lineHeight: 1.25 }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.4 }}>{m.short}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════ ПОТРЕБНОСТИ ══════════ */}
        <div className="section">
          <div className="section-head">
            <h3>Базовые потребности</h3>
            {hasChildhood ? (
              <button className="link" onClick={() => onOpenChildhoodWheel?.()}>Изменить детство →</button>
            ) : (
              <button className="link" onClick={() => onOpenChildhoodWheel?.()}>Пройти колесо детства →</button>
            )}
          </div>

          {!hasChildhood && (
            <div onClick={() => onOpenChildhoodWheel?.()} className="list-line" style={{ cursor: 'pointer', marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌱</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Колесо детства</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>Как потребности удовлетворялись в детстве?</div>
              </div>
              <span style={{ color: 'var(--text-faint)', fontSize: 14 }}>›</span>
            </div>
          )}

          {NEED_IDS.map(({ id, color }) => {
            const d = NEED_DATA[id];
            if (!d) return null;
            const childScore = childhoodRatings[id];
            return (
              <div key={id} onClick={() => setDetailNeedId(id)} className="list-line" style={{ cursor: 'pointer' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: `${color}18`, border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>
                  {d.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.25 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>{d.hint}</div>
                </div>
                {childScore !== undefined ? (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: needScoreColor(childScore), lineHeight: 1 }}>{childScore}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.04em', marginTop: 2 }}>детство</div>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-faint)', fontSize: 14, flexShrink: 0 }}>›</span>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Modals ── */}
      {showSchemaPicker && (
        <SchemaPickerSheet
          selected={manualSchemaIds}
          onSave={saveSchemas}
          onClose={() => setShowSchemaPicker(false)}
        />
      )}

      {showModePicker && (
        <ModePickerSheet
          selected={myModeIds}
          onSave={ids => { localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(ids)); setMyModeIds(ids); api.updateSettings({ myModeIds: ids }).catch(() => {}); }}
          onClose={() => setShowModePicker(false)}
        />
      )}

      {introModeId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
          <Suspense fallback={null}><ModeEx onBack={() => setIntroModeId(null)} initialModeId={introModeId} /></Suspense>
        </div>
      )}

      {detailSchemaId && (
        <SchemaDetailSheet
          schemaId={detailSchemaId}
          onClose={() => setDetailSchemaId(null)}
        />
      )}

      {detailNeedId && (
        <NeedDetailSheet
          needId={detailNeedId}
          childhoodRating={childhoodRatings[detailNeedId]}
          activeSchemaIds={allSchemaIds}
          onClose={() => setDetailNeedId(null)}
        />
      )}

      {showMyMap && <MyModeMapSheet onClose={() => setShowMyMap(false)} />}
    </div>
  );
}

function MyModeMapSheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(var(--fg-rgb),0.07)' }}>
        <button onClick={goBack} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text)' }}>
          <GlyphArrowLeft />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Карта режимов</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Suspense fallback={null}><ModeMapViewer /></Suspense>
      </div>
    </div>
  );
}

// ── Mode picker sheet ──────────────────────────────────────────────────────────

const POPULAR_MODE_IDS = ['vulnerable_child', 'detached_protector', 'demanding_critic', 'abandoned_child', 'compliant_surrenderer'];

const MODE_DESC: Record<string, string> = {
  vulnerable_child:      'Беспомощность, грусть, страх – нуждается в защите',
  lonely_child:          'Одиночество и непонятость даже среди людей',
  abandoned_child:       'Страх быть брошенным, тревога при угрозе отношениям',
  humiliated_child:      'Стыд и ощущение дефективности, страх осуждения',
  dependent_child:       'Нужна постоянная поддержка, боится самостоятельных решений',
  angry_child:           'Злость из-за неудовлетворённых потребностей',
  stubborn_child:        'Упрямое сопротивление требованиям и контролю',
  enraged_child:         'Неконтролируемая ярость при угрозе или несправедливости',
  impulsive_child:       'Действует не думая, следует желаниям без учёта последствий',
  undisciplined_child:   'Избегает скучного, быстро теряет интерес и бросает',
  compliant_surrenderer: 'Соглашается со всем, чтобы избежать конфликта',
  helpless_surrenderer:  'Ощущает себя беспомощным, ждёт что другие всё решат',
  detached_protector:    'Отключается эмоционально, уходит в себя чтобы не чувствовать',
  detached_self_soother: 'Успокаивает себя через еду, экраны, привычки',
  avoidant_protector:    'Избегает ситуаций и людей, которые могут причинить боль',
  angry_protector:       'Отталкивает других злостью, защищаясь от уязвимости',
  self_aggrandiser:      'Ощущение особости и превосходства над другими',
  overcontroller:        'Стремится всё контролировать, тревожится от неопределённости',
  perfectionistic_oc:    'Недостижимые стандарты, страх малейшей ошибки',
  suspicious_oc:         'Постоянная настороженность, ищет скрытые угрозы',
  invincible_oc:         'Отрицает слабость – должен быть сильным всегда',
  flagellating_oc:       'Наказывает себя за ошибки строже чем нужно',
  compulsive_oc:         'Навязчивые ритуалы и действия для снижения тревоги',
  worrying_oc:           'Хроническое беспокойство о будущих катастрофах',
  bully_attack:          'Добивается своего через запугивание и агрессию',
  manipulative:          'Влияет на людей косвенно, скрывая истинные намерения',
  predator:              'Использует других в своих интересах без сочувствия',
  attention_seeker:      'Постоянно ищет признания и похвалы от окружающих',
  pollyanna:             'Отрицает проблемы, видит всё в розовом цвете',
  demanding_critic:      'Внутренний голос завышенных требований и критики',
  punitive_critic:       'Жёсткое внутреннее осуждение и приговоры себе',
  guilt_critic:          'Постоянное чувство вины и самообвинения',
  happy_child:           'Спонтанность, радость и игривость без тревоги',
  healthy_adult:         'Взвешенные решения, забота о себе и других',
  good_parent:           'Внутренний поддерживающий голос, ободряет и успокаивает',
};

function ModePickerSheet({ selected, onSave, onClose }: { selected: string[]; onSave: (ids: string[]) => void; onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [ids, setIds] = useState<string[]>(selected);
  const toggle = (id: string) => setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="ex-btn ex-btn-ghost" onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
        <button onClick={() => { onSave(ids); goBack(); }} className="ex-btn ex-btn-primary" style={{ padding: '7px 20px' }}>
          Сохранить{ids.length > 0 ? ` · ${ids.length}` : ''}
        </button>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>Мои режимы</h1>
        <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 28, lineHeight: 1.6 }}>
          {tr('Выбери режимы которые ты замечаешь у себя.', 'Выберите режимы которые вы замечаете у себя.')}
        </p>

        <div style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            С чего начать
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {POPULAR_MODE_IDS.map(id => {
              const mode = ALL_MODES.find(m => m.id === id);
              if (!mode) return null;
              const active = ids.includes(id);
              const c = mode.groupColor; // CSS variable
              return (
                <div key={id} onClick={() => toggle(id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: active ? cm(c, 9) : 'rgba(var(--fg-rgb),0.04)', border: `1px solid ${active ? cm(c, 20) : 'rgba(var(--fg-rgb),0.08)'}`, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{mode.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: active ? 'var(--text)' : 'var(--text-sub)', fontWeight: active ? 500 : 400 }}>{mode.name}</div>
                    {MODE_DESC[id] && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2, lineHeight: 1.4 }}>{MODE_DESC[id]}</div>}
                  </div>
                  {active && <span style={{ color: c, fontSize: 14, flexShrink: 0 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(var(--fg-rgb),0.06)', marginBottom: 18 }} />
        <div className="eyebrow" style={{ marginBottom: 14 }}>Все режимы</div>

        {MODE_GROUPS.map(group => {
          const c = group.color; // CSS variable
          return (
            <div key={group.id} style={{ marginBottom: 18 }}>
              <div className="eyebrow" style={{ color: c, marginBottom: 8, opacity: 0.8 }}>
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.items.filter(m => !POPULAR_MODE_IDS.includes(m.id)).map(m => {
                  const active = ids.includes(m.id);
                  return (
                    <div key={m.id} onClick={() => toggle(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: active ? cm(c, 9) : 'rgba(var(--fg-rgb),0.03)', border: `1px solid ${active ? cm(c, 20) : 'rgba(var(--fg-rgb),0.06)'}`, transition: 'all 0.15s' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{m.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: active ? 'var(--text)' : 'var(--text-sub)', fontWeight: active ? 500 : 400 }}>{m.name}</div>
                        {MODE_DESC[m.id] && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2, lineHeight: 1.4 }}>{MODE_DESC[m.id]}</div>}
                      </div>
                      {active && <span style={{ color: c, fontSize: 14, flexShrink: 0 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
