import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtDate } from '../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS, ALL_MODES } from '../schemaTherapyData';
import { NEED_DATA } from '../needData';
import { SchemaPickerSheet } from '../components/SchemaPickerSheet';
import { BottomSheet } from '../components/BottomSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { SchemaDetailSheet } from '../components/SchemaDetailSheet';
import { NeedDetailSheet } from '../components/NeedDetailSheet';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';

/** color-mix: works with CSS vars AND hex. Replaces the old hex-alpha hack. */
function cm(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
/** Keep hex() for dot/icon backgrounds where we need a solid resolved color */
const VAR_HEX: Record<string, string> = {
  'var(--accent-red)':    '#f87171',
  'var(--accent-orange)': '#fb923c',
  'var(--accent-yellow)': '#facc15',
  'var(--accent-green)':  '#4ade80',
  'var(--accent-indigo)': '#818cf8',
  'var(--accent-blue)':   '#60a5fa',
  'var(--accent)':        '#a78bfa',
};
function hex(color: string) { return VAR_HEX[color] ?? color; }

const NEED_IDS: { id: string; color: string }[] = [
  { id: 'attachment', color: '#ff6b9d' },
  { id: 'autonomy',   color: '#4fa3f7' },
  { id: 'expression', color: '#facc15' },
  { id: 'play',       color: '#06d6a0' },
  { id: 'limits',     color: '#a78bfa' },
];

function readLocalIds(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
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

type Tab = 'schemas' | 'modes' | 'needs';

export function SchemasSection({ onOpenSchema, childhoodRatings = {}, onOpenChildhoodWheel }: Props) {
  const [tab, setTab]                     = useState<Tab>('schemas');
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() => readLocalIds(MY_SCHEMA_IDS_KEY));
  const [myModeIds, setMyModeIds]         = useState<string[]>(() => readLocalIds(MY_MODE_IDS_KEY));
  const [ysqSchemaIds, setYsqSchemaIds]   = useState<string[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);
  const [showModePicker, setShowModePicker]     = useState(false);
  const [introModeId, setIntroModeId]     = useState<string | null>(null);
  const [detailSchemaId, setDetailSchemaId] = useState<string | null>(null);
  const [introSchemaId, setIntroSchemaId] = useState<string | null>(null);
  const [detailNeedId, setDetailNeedId]   = useState<string | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedModeGroups, setExpandedModeGroups] = useState<Set<string>>(new Set());
  const [ysqCompletedAt, setYsqCompletedAt] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile().then(p => {
      const serverSchemas = p.mySchemaIds ?? [];
      const serverModes   = p.myModeIds ?? [];
      setManualSchemaIds(serverSchemas);
      if (serverSchemas.length > 0) localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(serverSchemas));
      setMyModeIds(serverModes);
      if (serverModes.length > 0) localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(serverModes));
      setYsqSchemaIds(p.ysq.activeSchemaIds ?? []);
      setYsqCompletedAt(p.ysq.completedAt);
      setProfileLoading(false);
    }).catch(() => setProfileLoading(false));
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

  function toggleDomain(id: string) {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleModeGroup(id: string) {
    setExpandedModeGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const hasChildhood = Object.keys(childhoodRatings).length > 0;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'schemas', label: 'Схемы' },
    { id: 'modes',   label: 'Режимы' },
    { id: 'needs',   label: 'Потребности' },
  ];

  return (
    <div className="page-inner-wide">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 6 }}>
            Паттерны
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>Схемы, режимы, потребности</div>
        </div>
        <button onClick={() => onOpenSchema()} className="btn btn-secondary">
          📖 <span>Библиотека</span>
        </button>
      </div>

      {/* ── Tab switcher ── */}
      <div className="tabs" style={{ padding: '0', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`tab${tab === t.id ? ' is-active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div>

        {/* ══════════════════════ СХЕМЫ ══════════════════════ */}
        {tab === 'schemas' && (
          <>
            {/* МОИ СХЕМЫ */}
            <div className="section">
              <div className="section-head"><h3>Мои схемы</h3></div>
              {profileLoading ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[80, 100, 90, 110].map((w, i) => (
                    <div key={i} style={{ height: 32, width: w, borderRadius: 20,
                      background: 'linear-gradient(90deg,transparent 25%,transparent 50%,transparent 75%)',
                      backgroundSize: '200% auto', animation: 'shimmer 1.5s linear infinite' }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {allSchemaIds.map(id => {
                    const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === id));
                    const schema = domain?.schemas.find(s => s.id === id);
                    if (!schema || !domain) return null;
                    const c = domain.color; // CSS variable — use directly
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
                  <button onClick={() => setShowSchemaPicker(true)} style={{
                    padding: '6px 13px', borderRadius: 20,
                    border: '1.5px dashed var(--line)',
                    background: 'transparent',
                    color: 'var(--text-sub)', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                    + Добавить
                  </button>
                </div>
              )}
            </div>

            {/* YSQ card */}
            <div className="section">
              <div className="section-head">
                <h3>YSQ-тест схем</h3>
                <button onClick={() => onOpenSchema({ startTest: true })} className="link">
                  {ysqCompletedAt ? `пройден ${fmtDate(ysqCompletedAt.slice(0, 10))} · пройти снова →` : 'Начать →'}
                </button>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                {ysqCompletedAt ? '116 вопросов · определяет активные схемы автоматически' : 'Определи схемы автоматически — 116 вопросов, 10 минут'}
              </div>
            </div>

            {/* ВСЕ СХЕМЫ */}
            <div className="section">
              <div className="section-head"><h3>Все схемы</h3></div>
              <div>
                {SCHEMA_DOMAINS.map(domain => {
                  const isOpen = expandedDomains.has(domain.id);
                  const c = domain.color; // CSS variable
                  return (
                    <div key={domain.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <div onClick={() => toggleDomain(domain.id)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', cursor: 'pointer',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: hex(c), flexShrink: 0 }} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                            {domain.domain}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                            {domain.schemas.length}
                          </span>
                          <span style={{
                            color: 'var(--text-faint)', fontSize: 14,
                            display: 'inline-block',
                            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                          }}>›</span>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '0 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {domain.schemas.map(s => {
                            const active = allSchemaIds.includes(s.id);
                            return (
                              <button key={s.id} onClick={() => setDetailSchemaId(s.id)} style={{
                                padding: '6px 13px', borderRadius: 20,
                                border: `1.5px solid ${cm(c, active ? 42 : 18)}`,
                                background: cm(c, active ? 11 : 5),
                                color: active ? c : 'var(--text-sub)',
                                fontSize: 13, fontWeight: active ? 600 : 400,
                                cursor: 'pointer', fontFamily: 'inherit',
                                WebkitTapHighlightColor: 'transparent',
                              }}>
                                {shortName(s.name)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════ РЕЖИМЫ ══════════════════════ */}
        {tab === 'modes' && (
          <>
            {/* МОИ РЕЖИМЫ */}
            <div className="section">
              <div className="section-head"><h3>Мои режимы</h3></div>
              {profileLoading ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[90, 110, 80].map((w, i) => (
                    <div key={i} style={{ height: 32, width: w, borderRadius: 20,
                      background: 'linear-gradient(90deg,transparent 25%,transparent 50%,transparent 75%)',
                      backgroundSize: '200% auto', animation: 'shimmer 1.5s linear infinite' }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {myModes.map(m => {
                    const c = m.groupColor; // CSS variable
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
                  <button onClick={() => setShowModePicker(true)} style={{
                    padding: '6px 13px', borderRadius: 20,
                    border: '1.5px dashed var(--line)',
                    background: 'transparent',
                    color: 'var(--text-sub)', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                    + Добавить
                  </button>
                </div>
              )}
            </div>

            {/* ВСЕ РЕЖИМЫ */}
            <div className="section">
              <div className="section-head"><h3>Все режимы</h3></div>
              <div>
                {MODE_GROUPS.map(group => {
                  const isOpen = expandedModeGroups.has(group.id);
                  const c = group.color; // CSS variable
                  return (
                    <div key={group.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <div onClick={() => toggleModeGroup(group.id)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', cursor: 'pointer',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: hex(c), flexShrink: 0 }} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                            {group.group}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                            {group.items.length}
                          </span>
                          <span style={{
                            color: 'var(--text-faint)', fontSize: 14,
                            display: 'inline-block',
                            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                          }}>›</span>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '0 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {group.items.map(m => {
                            const active = myModeIds.includes(m.id);
                            return (
                              <button key={m.id} onClick={() => setIntroModeId(m.id)} style={{
                                padding: '6px 12px', borderRadius: 20,
                                border: `1.5px solid ${cm(c, active ? 42 : 18)}`,
                                background: cm(c, active ? 11 : 5),
                                color: active ? c : 'var(--text-sub)',
                                fontSize: 13, fontWeight: active ? 600 : 400,
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
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════ ПОТРЕБНОСТИ ══════════════════════ */}
        {tab === 'needs' && (
          <>
            <div className="section">
              <div className="section-head">
                <h3>Потребности</h3>
                {hasChildhood && (
                  <button className="link" onClick={() => onOpenChildhoodWheel?.()}>Изменить детство →</button>
                )}
              </div>

              {!hasChildhood && (
                <div onClick={() => onOpenChildhoodWheel?.()} className="list-line" style={{ cursor: 'pointer' }}>
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

          </>
        )}

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
        <ModeIntroSheet modeId={introModeId} onClose={() => setIntroModeId(null)} />
      )}

      {detailSchemaId && (
        <SchemaDetailSheet
          schemaId={detailSchemaId}
          onClose={() => setDetailSchemaId(null)}
          onOpenDiary={() => setIntroSchemaId(detailSchemaId)}
        />
      )}

      {introSchemaId && (
        <SchemaIntroSheet schemaId={introSchemaId} onClose={() => setIntroSchemaId(null)} />
      )}

      {detailNeedId && (
        <NeedDetailSheet
          needId={detailNeedId}
          childhoodRating={childhoodRatings[detailNeedId]}
          activeSchemaIds={allSchemaIds}
          onClose={() => setDetailNeedId(null)}
        />
      )}
    </div>
  );
}

// ── Mode picker sheet ──────────────────────────────────────────────────────────

const POPULAR_MODE_IDS = ['vulnerable_child', 'detached_protector', 'demanding_critic', 'abandoned_child', 'compliant_surrenderer'];

const MODE_DESC: Record<string, string> = {
  vulnerable_child:      'Беспомощность, грусть, страх — нуждается в защите',
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
  invincible_oc:         'Отрицает слабость — должен быть сильным всегда',
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
  const [ids, setIds] = useState<string[]>(selected);
  const toggle = (id: string) => setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Мои режимы</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.5 }}>
          Выбери режимы которые ты замечаешь у себя.
        </div>

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

        <button onClick={() => { onSave(ids); onClose(); }} style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, var(--accent), var(--accent-blue))', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
          Сохранить{ids.length > 0 ? ` (${ids.length})` : ''}
        </button>
      </div>
    </BottomSheet>
  );
}
