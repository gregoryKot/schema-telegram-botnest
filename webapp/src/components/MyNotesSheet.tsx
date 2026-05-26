import { useState, useEffect, lazy, Suspense } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { api } from '../api';
import { SCHEMA_DOMAINS, getModeById } from '../schemaTherapyData';

const SchemaEx = lazy(() => import('./exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx   = lazy(() => import('./exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));

// ─── Types ───────────────────────────────────────────────────────────────────

type SchemaNote = { schemaId: string; triggers: string; feelings: string; thoughts: string; origins: string; reality: string; healthyView: string; behavior: string };
type ModeNote   = { modeId: string; triggers: string; feelings: string; thoughts: string; needs: string; behavior: string };
type DiaryEntry = { id: number; createdAt: string; type: 'schema' | 'mode' | 'gratitude'; label: string; preview: string };
type Exercise   = { id: number; createdAt: string; type: 'belief' | 'letter' | 'flashcard'; label: string; preview: string };
type SafeEntry  = { description: string; updatedAt: string } | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VAR_HEX: Record<string, string> = {
  'var(--accent-red)':    '#f87171',
  'var(--accent-orange)': '#fb923c',
  'var(--accent-yellow)': '#facc15',
  'var(--accent-green)':  '#34d399',
  'var(--accent-indigo)': '#818cf8',
  'var(--accent-blue)':   '#60a5fa',
  'var(--accent)':        '#a78bfa',
};
function hex(color: string) { return VAR_HEX[color] ?? color; }

function notePreview(note: SchemaNote | ModeNote): string {
  const skip = new Set(['schemaId', 'modeId']);
  for (const [k, v] of Object.entries(note)) {
    if (!skip.has(k) && typeof v === 'string' && v.trim()) {
      const s = v.trim();
      return s.length > 70 ? s.slice(0, 70) + '…' : s;
    }
  }
  return '';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

type Tab = 'cards' | 'diary' | 'exercises';

interface Props { onClose: () => void; }

export function MyNotesSheet({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('cards');
  const [loading, setLoading] = useState(true);

  const [mySchemaIds, setMySchemaIds] = useState<string[]>([]);
  const [ysqSchemaIds, setYsqSchemaIds] = useState<string[]>([]);
  const [myModeIds, setMyModeIds] = useState<string[]>([]);

  const [schemaNotes, setSchemaNotes] = useState<SchemaNote[]>([]);
  const [modeNotes, setModeNotes]     = useState<ModeNote[]>([]);
  const [openSchemaId, setOpenSchemaId] = useState<string | null>(null);
  const [openModeId, setOpenModeId]     = useState<string | null>(null);

  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [safePlace, setSafePlace] = useState<SafeEntry>(null);

  useEffect(() => {
    Promise.all([
      api.getProfile().then(p => {
        setMySchemaIds(p.mySchemaIds ?? []);
        setYsqSchemaIds(p.ysq.activeSchemaIds ?? []);
        setMyModeIds(p.myModeIds ?? []);
      }).catch(() => {}),
      api.getSchemaNotes().then(setSchemaNotes).catch(() => {}),
      api.getModeNotes().then(setModeNotes).catch(() => {}),
      Promise.all([
        api.getSchemaDiary().catch(() => [] as any[]),
        api.getModeDiary().catch(() => [] as any[]),
        api.getGratitudeDiary().catch(() => [] as any[]),
      ]).then(([sd, md, gd]) => {
        const entries: DiaryEntry[] = [
          ...sd.map((e: any) => ({ id: e.id, createdAt: e.createdAt, type: 'schema' as const, label: 'Схемный дневник', preview: e.trigger ?? '' })),
          ...md.map((e: any) => ({ id: e.id, createdAt: e.createdAt, type: 'mode' as const, label: `Режим: ${getModeById(e.modeId)?.name ?? e.modeId}`, preview: e.situation ?? '' })),
          ...gd.map((e: any) => ({ id: e.id, createdAt: e.createdAt, type: 'gratitude' as const, label: 'Благодарность', preview: Array.isArray(e.items) ? e.items.slice(0, 2).join(', ') : '' })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);
        setDiaryEntries(entries);
      }),
      Promise.all([
        api.getBeliefChecks().catch(() => [] as any[]),
        api.getLetters().catch(() => [] as any[]),
        api.getFlashcards().catch(() => [] as any[]),
        api.getSafePlace().catch(() => null),
      ]).then(([bc, lt, fc, sp]) => {
        setSafePlace(sp);
        const exs: Exercise[] = [
          ...bc.map((e: any) => ({ id: e.id, createdAt: e.createdAt, type: 'belief' as const, label: 'Проверка убеждения', preview: e.belief ?? '' })),
          ...lt.map((e: any) => ({ id: e.id, createdAt: e.createdAt, type: 'letter' as const, label: 'Письмо себе', preview: e.text?.slice(0, 70) ?? '' })),
          ...fc.map((e: any) => ({ id: e.id, createdAt: e.createdAt, type: 'flashcard' as const, label: `Кризис: ${e.modeId}`, preview: e.action ?? e.reflection ?? '' })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);
        setExercises(exs);
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const allSchemaIds = [...new Set([...mySchemaIds, ...ysqSchemaIds])];
  const allModeIds   = myModeIds;
  const schemaCount  = allSchemaIds.length;
  const modeCount    = allModeIds.length;
  const cardCount    = schemaCount + modeCount;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'cards',     label: 'Карточки',   count: cardCount },
    { id: 'diary',     label: 'Дневник',    count: diaryEntries.length },
    { id: 'exercises', label: 'Практики',   count: exercises.length + (safePlace ? 1 : 0) },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      {/* Topbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px' }}>
        <button className="ex-btn ex-btn-ghost" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>
          Мои <span style={{ fontStyle: 'italic' }}>записи</span>
        </h1>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32, borderBottom: '1px solid var(--line)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14,
              color: tab === t.id ? 'var(--text)' : 'var(--text-sub)',
              fontWeight: tab === t.id ? 600 : 400,
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}>
              {t.label}{t.count > 0 ? ` · ${t.count}` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ fontSize: 14, color: 'var(--text-sub)', padding: '16px 0' }}>Загрузка…</div>
        ) : (
          <>
            {/* ── Карточки ── */}
            {tab === 'cards' && (
              allSchemaIds.length === 0 && allModeIds.length === 0 ? (
                <EmptyState emoji="🧩" text="Схемы и режимы не выбраны" sub="Добавь их в разделе Паттерны" />
              ) : (
                <>
                  {allSchemaIds.length > 0 && (
                    <div style={{ marginBottom: 32 }}>
                      <div className="eyebrow" style={{ marginBottom: 14 }}>Схемы · {allSchemaIds.length}</div>
                      {SCHEMA_DOMAINS.map(domain => {
                        const domainSchemas = domain.schemas.filter(s => allSchemaIds.includes(s.id));
                        if (domainSchemas.length === 0) return null;
                        const colorHex = hex(domain.color);
                        return (
                          <div key={domain.id} style={{ marginBottom: 16 }}>
                            <div className="eyebrow" style={{ color: domain.color, opacity: 0.8, marginBottom: 8 }}>
                              {domain.domain}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {domainSchemas.map(s => {
                                const note = schemaNotes.find(n => n.schemaId === s.id);
                                const filled = note && Object.entries(note).some(([k, v]) => k !== 'schemaId' && typeof v === 'string' && v.trim());
                                return (
                                  <div key={s.id} onClick={() => setOpenSchemaId(s.id)} style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
                                    background: `${colorHex}0a`, border: `1px solid ${colorHex}20`,
                                  }}>
                                    <div style={{
                                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                      background: `${colorHex}18`, border: `1px solid ${colorHex}30`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                                    }}>
                                      {(s as any).emoji ?? '●'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--text)', lineHeight: 1.2 }}>{s.name}</div>
                                      {filled && note ? (
                                        <div style={{ fontSize: 11, color: domain.color, marginTop: 3 }}>Заполнено · {notePreview(note).slice(0, 40)}</div>
                                      ) : (
                                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>Нажми, чтобы заполнить →</div>
                                      )}
                                    </div>
                                    <span style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}>›</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {allModeIds.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div className="eyebrow" style={{ marginBottom: 14 }}>Режимы · {allModeIds.length}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {allModeIds.map(id => {
                          const m = getModeById(id);
                          if (!m) return null;
                          const note = modeNotes.find(n => n.modeId === id);
                          const filled = note && Object.entries(note).some(([k, v]) => k !== 'modeId' && typeof v === 'string' && v.trim());
                          const colorHex = hex(m.groupColor);
                          return (
                            <div key={id} onClick={() => setOpenModeId(id)} style={{
                              display: 'flex', alignItems: 'center', gap: 14,
                              padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
                              background: `${colorHex}0a`, border: `1px solid ${colorHex}18`,
                            }}>
                              <div style={{
                                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                background: `${colorHex}18`, border: `1px solid ${colorHex}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                              }}>
                                {m.emoji}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--text)', lineHeight: 1.2 }}>{m.name}</div>
                                {filled && note ? (
                                  <div style={{ fontSize: 11, color: m.groupColor, marginTop: 3 }}>Заполнено · {notePreview(note).slice(0, 40)}</div>
                                ) : (
                                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>Нажми, чтобы заполнить →</div>
                                )}
                              </div>
                              <span style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}>›</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )
            )}

            {/* ── Дневник ── */}
            {tab === 'diary' && (
              diaryEntries.length === 0 ? (
                <EmptyState emoji="📔" text="Пока нет записей" sub="Дневники доступны на вкладке Дневник" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {diaryEntries.map(e => {
                    const EMOJI: Record<string, string> = { schema: '📓', mode: '🔄', gratitude: '🌱' };
                    return (
                      <div key={`${e.type}-${e.id}`} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sub)' }}>{EMOJI[e.type]} {e.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{fmtDate(e.createdAt)}</span>
                        </div>
                        {e.preview && (
                          <div style={{ fontSize: 13, color: 'var(--text-sub)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{e.preview}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ── Практики ── */}
            {tab === 'exercises' && (
              exercises.length === 0 && !safePlace ? (
                <EmptyState emoji="🔍" text="Выполненные практики" sub="Проверки убеждений, письма, карточки кризиса" />
              ) : (
                <>
                  {safePlace && (
                    <div style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 14%, transparent)', borderRadius: 14, padding: '14px 18px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)' }}>🏡 Безопасное место</span>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{new Date(safePlace.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{safePlace.description}</div>
                    </div>
                  )}
                  {exercises.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {exercises.map(e => {
                        const EMOJI: Record<string, string> = { belief: '🔍', letter: '✉️', flashcard: '🆘' };
                        return (
                          <div key={`${e.type}-${e.id}`} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sub)' }}>{EMOJI[e.type]} {e.label}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{fmtDate(e.createdAt)}</span>
                            </div>
                            {e.preview && (
                              <div style={{ fontSize: 13, color: 'var(--text-sub)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{e.preview}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )
            )}
          </>
        )}
      </div>

      {/* Schema card overlay */}
      {openSchemaId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <SchemaEx
              onBack={() => setOpenSchemaId(null)}
              initialSchemaId={openSchemaId}
              onComplete={() => api.getSchemaNotes().then(setSchemaNotes).catch(() => {})}
            />
          </Suspense>
        </div>
      )}

      {/* Mode card overlay */}
      {openModeId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <ModeEx
              onBack={() => setOpenModeId(null)}
              initialModeId={openModeId}
              onComplete={() => api.getModeNotes().then(setModeNotes).catch(() => {})}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

function EmptyState({ emoji, text, sub }: { emoji: string; text: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>{emoji}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--text-sub)', lineHeight: 1.5 }}>{text}</div>
      <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 10 }}>{sub}</div>
    </div>
  );
}
