import { useState, useEffect, lazy, Suspense } from 'react';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api } from '../api';
import { SCHEMA_DOMAINS, getModeById } from '../schemaTherapyData';

const SchemaEx = lazy(() => import('./exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx   = lazy(() => import('./exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));

type SchemaNote = { schemaId: string; triggers: string; feelings: string; thoughts: string; origins: string; reality: string; healthyView: string; behavior: string };
type ModeNote   = { modeId: string; triggers: string; feelings: string; thoughts: string; needs: string; behavior: string };
type DiaryEntry = { id: number; createdAt: string; type: 'schema' | 'mode' | 'gratitude'; label: string; preview: string };
type Exercise   = { id: number; createdAt: string; type: 'belief' | 'letter' | 'flashcard'; label: string; preview: string };
type SafeEntry  = { description: string; updatedAt: string } | null;


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
  const goBack = useHistorySheet(onClose);
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
  const cardCount    = allSchemaIds.length + allModeIds.length;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'cards',     label: 'Карточки',   count: cardCount },
    { id: 'diary',     label: 'Дневник',    count: diaryEntries.length },
    { id: 'exercises', label: 'Практики',   count: exercises.length + (safePlace ? 1 : 0) },
  ];

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      eyebrow="Личный архив"
      eyebrowColor="var(--accent)"
      title={<>Мои <span className="it">записи</span></>}
      lede="Карточки схем и режимов, дневниковые записи, завершённые практики – всё в одном месте."
    >
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid var(--line)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
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
            allSchemaIds.length === 0 && allModeIds.length === 0
              ? <EmptyState emoji="🧩" text="Схемы и режимы не выбраны" sub="Добавь их в разделе Паттерны" />
              : <>
                  {allSchemaIds.length > 0 && (
                    <div style={{ marginBottom: 40 }}>
                      <div className="eyebrow" style={{ marginBottom: 14 }}>Схемы · {allSchemaIds.length}</div>
                      {SCHEMA_DOMAINS.map(domain => {
                        const domainSchemas = domain.schemas.filter(s => allSchemaIds.includes(s.id));
                        if (domainSchemas.length === 0) return null;
                        return (
                          <div key={domain.id} style={{ marginBottom: 20 }}>
                            <div className="eyebrow" style={{ color: domain.color, marginBottom: 8 }}>{domain.domain}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {domainSchemas.map(s => {
                                const note = schemaNotes.find(n => n.schemaId === s.id);
                                const filled = note && Object.entries(note).some(([k, v]) => k !== 'schemaId' && typeof v === 'string' && v.trim());
                                return (
                                  <div key={s.id} onClick={() => setOpenSchemaId(s.id)}
                                    className="mode-card"
                                    style={{ '--mode-color': domain.color } as React.CSSProperties}
                                  >
                                    <span className="mode-card-stripe" />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="mode-card-name">{(s as any).emoji ?? '●'} {s.name}</div>
                                      <div className="mode-card-short">
                                        {filled && note ? `Заполнено · ${notePreview(note).slice(0, 40)}` : 'Нажми, чтобы заполнить →'}
                                      </div>
                                    </div>
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
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 14 }}>Режимы · {allModeIds.length}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {allModeIds.map(id => {
                          const m = getModeById(id);
                          if (!m) return null;
                          const note = modeNotes.find(n => n.modeId === id);
                          const filled = note && Object.entries(note).some(([k, v]) => k !== 'modeId' && typeof v === 'string' && v.trim());
                          return (
                            <div key={id} onClick={() => setOpenModeId(id)}
                              className="mode-card"
                              style={{ '--mode-color': m.groupColor } as React.CSSProperties}
                            >
                              <span className="mode-card-stripe" />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="mode-card-name">{m.emoji} {m.name}</div>
                                <div className="mode-card-short">
                                  {filled && note ? `Заполнено · ${notePreview(note).slice(0, 40)}` : 'Нажми, чтобы заполнить →'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
          )}

          {/* ── Дневник ── */}
          {tab === 'diary' && (
            diaryEntries.length === 0
              ? <EmptyState emoji="📔" text="Пока нет записей" sub="Дневники доступны на вкладке Дневник" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {diaryEntries.map(e => {
                    const EMOJI: Record<string, string> = { schema: '📓', mode: '🔄', gratitude: '🌱' };
                    return (
                      <div key={`${e.type}-${e.id}`} className="list-line">
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{EMOJI[e.type]}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{e.label}</div>
                          {e.preview && <div style={{ fontSize: 12, color: 'var(--text-faint)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginTop: 2 }}>{e.preview}</div>}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-ghost)', flexShrink: 0 }}>{fmtDate(e.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
          )}

          {/* ── Практики ── */}
          {tab === 'exercises' && (
            exercises.length === 0 && !safePlace
              ? <EmptyState emoji="🔍" text="Нет завершённых практик" sub="Проверки убеждений, письма, карточки кризиса" />
              : <>
                  {safePlace && (
                    <div className="list-line">
                      <span style={{ fontSize: 20, flexShrink: 0 }}>🏡</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-moss)' }}>Безопасное место</div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginTop: 2 }}>{safePlace.description}</div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-ghost)', flexShrink: 0 }}>{new Date(safePlace.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  )}
                  {exercises.map(e => {
                    const EMOJI: Record<string, string> = { belief: '🔍', letter: '✉️', flashcard: '🆘' };
                    return (
                      <div key={`${e.type}-${e.id}`} className="list-line">
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{EMOJI[e.type]}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{e.label}</div>
                          {e.preview && <div style={{ fontSize: 12, color: 'var(--text-faint)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginTop: 2 }}>{e.preview}</div>}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-ghost)', flexShrink: 0 }}>{fmtDate(e.createdAt)}</span>
                      </div>
                    );
                  })}
                </>
          )}
        </>
      )}

      {/* Schema card overlay */}
      {openSchemaId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', overflowY: 'auto' }}>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <ModeEx
              onBack={() => setOpenModeId(null)}
              initialModeId={openModeId}
              onComplete={() => api.getModeNotes().then(setModeNotes).catch(() => {})}
            />
          </Suspense>
        </div>
      )}
    </ExScreen>
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
