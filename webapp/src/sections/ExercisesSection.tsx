import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from '../api';
import { Loader } from '../components/Loader';

const BeliefCheckEx    = lazy(() => import('../components/exercises/BeliefCheckEx').then(m => ({ default: m.BeliefCheckEx })));
const SchemaEx         = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx           = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));
const LetterEx         = lazy(() => import('../components/exercises/LetterEx').then(m => ({ default: m.LetterEx })));
const SafePlaceEx      = lazy(() => import('../components/exercises/SafePlaceEx').then(m => ({ default: m.SafePlaceEx })));
const ChildhoodWheelEx = lazy(() => import('../components/exercises/ChildhoodWheelEx').then(m => ({ default: m.ChildhoodWheelEx })));

type ExId = 'belief' | 'schema' | 'mode' | 'letter' | 'safe' | 'wheel';
interface ExStats { count: number; lastDone: string | null; }

const EXERCISES = [
  { id: 'belief' as ExId, num: '01', eyebrow: 'Когнитивная работа',    title: 'Проверка убеждения',       desc: 'Поставить мысль перед судом фактов. Что её подтверждает, что опровергает, и как сформулировать точнее.', time: '8–12 мин', color: 'var(--c-slate)' },
  { id: 'schema' as ExId, num: '02', eyebrow: 'Знакомство',             title: 'Карточка схемы',            desc: 'Семь вопросов про одну из схем: триггеры, телесные отклики, голос, истоки, реальность, здоровый взгляд, действия.', time: '10–15 мин', color: 'var(--c-plum)' },
  { id: 'mode'   as ExId, num: '03', eyebrow: 'Знакомство',             title: 'Карточка режима',           desc: 'Пять вопросов про режим: когда активируется, что чувствует, что говорит, что хочет, как ведёт себя.', time: '7–10 мин', color: 'var(--c-clay)' },
  { id: 'letter' as ExId, num: '04', eyebrow: 'Эмоциональная работа',  title: 'Письмо уязвимому ребёнку', desc: 'Сесть рядом с собой-маленьким и сказать ему то, что он должен был услышать. От сегодняшнего тебя.', time: '15–25 мин', color: 'var(--c-amber)' },
  { id: 'safe'   as ExId, num: '05', eyebrow: 'Ресурс',                 title: 'Безопасное место',          desc: 'Описать место, в которое можно мысленно возвращаться. Чтобы было куда — в тревожный момент.', time: '5–10 мин', color: 'var(--c-moss)' },
  { id: 'wheel'  as ExId, num: '06', eyebrow: 'Истоки',                 title: 'Колесо детства',            desc: 'Оценить пять базовых потребностей в детстве. Найти связь с тем, как трудно сегодня.', time: '8–12 мин', color: 'var(--accent-indigo)' },
];

const GROUPS = [
  { id: 'g1', num: 'I',   title: 'Когнитивная работа',       desc: 'Проверять мысли, искать факты',       ids: ['belief'] as ExId[] },
  { id: 'g2', num: 'II',  title: 'Знакомство с паттернами',  desc: 'Опознать схемы и режимы по имени',    ids: ['schema', 'mode'] as ExId[] },
  { id: 'g3', num: 'III', title: 'Эмоциональная работа',     desc: 'Письма, образы, голоса',              ids: ['letter', 'safe'] as ExId[] },
  { id: 'g4', num: 'IV',  title: 'Истоки',                   desc: 'Откуда это пришло',                   ids: ['wheel'] as ExId[] },
];

function fmtAgo(d: string | null): string {
  if (!d) return 'пройдено';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function fmtCount(n: number, noun: string): string {
  if (n === 1) return `1 ${noun}`;
  if (n < 5) return `${n} ${noun}и`;
  return `${n} ${noun}ей`;
}

const GlyphArrow = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export function ExercisesSection() {
  const [open, setOpen] = useState<ExId | null>(null);
  const [stats, setStats] = useState<Partial<Record<ExId, ExStats>>>({});

  useEffect(() => {
    Promise.allSettled([
      api.getBeliefChecks(),
      api.getSchemaNotes(),
      api.getModeNotes(),
      api.getLetters(),
      api.getSafePlace(),
      api.getChildhoodRatings(),
    ]).then(([beliefs, schemas, modes, letters, safe, wheel]) => {
      const upd: Partial<Record<ExId, ExStats>> = {};
      if (beliefs.status === 'fulfilled') {
        const b = beliefs.value as any[];
        if (b.length) upd.belief = { count: b.length, lastDone: b[0]?.createdAt ?? null };
      }
      if (schemas.status === 'fulfilled') {
        const s = schemas.value as any[];
        if (s.length) {
          const sorted = [...s].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
          upd.schema = { count: s.length, lastDone: sorted[0]?.updatedAt ?? null };
        }
      }
      if (modes.status === 'fulfilled') {
        const m = modes.value as any[];
        if (m.length) {
          const sorted = [...m].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
          upd.mode = { count: m.length, lastDone: sorted[0]?.updatedAt ?? null };
        }
      }
      if (letters.status === 'fulfilled') {
        const l = letters.value as any[];
        if (l.length) upd.letter = { count: l.length, lastDone: l[0]?.createdAt ?? null };
      }
      if (safe.status === 'fulfilled' && safe.value) {
        upd.safe = { count: 1, lastDone: (safe.value as any).updatedAt ?? null };
      }
      if (wheel.status === 'fulfilled' && Object.keys(wheel.value as object).length > 0) {
        upd.wheel = { count: 1, lastDone: null };
      }
      setStats(upd);
    });
  }, []);

  if (open) {
    const onBack = () => setOpen(null);
    return (
      <Suspense fallback={<Loader minHeight="100dvh" />}>
        {open === 'belief' && <BeliefCheckEx onBack={onBack} />}
        {open === 'schema' && <SchemaEx onBack={onBack} />}
        {open === 'mode'   && <ModeEx onBack={onBack} />}
        {open === 'letter' && <LetterEx onBack={onBack} />}
        {open === 'safe'   && <SafePlaceEx onBack={onBack} />}
        {open === 'wheel'  && <ChildhoodWheelEx onBack={onBack} />}
      </Suspense>
    );
  }

  const suggested = EXERCISES.find(e => !stats[e.id]) ?? EXERCISES[0];

  return (
    <div className="page">
      <div className="page-inner">
        <div className="hub-hero">
          <div>
            <div className="eyebrow" style={{ marginBottom: 20 }}>
              <span style={{ color: 'var(--accent)' }}>● </span>
              Библиотека практик · 6 упражнений
            </div>
            <h1 className="hub-title">
              Упражнения<br/>
              <span className="accent">для работы с собой</span>
            </h1>
            <p className="hub-sub">
              Шесть практик схема-терапии — от проверки одной мысли до письма себе-маленькому.
              Никаких таймеров, никаких баллов. Делай тогда, когда нужно.
            </p>
          </div>
          <div className="hub-aside">
            <div className="hub-aside-eyebrow">Сегодня предлагаю</div>
            <h2 className="hub-aside-title">{suggested.title}</h2>
            <p className="hub-aside-body">{suggested.desc}</p>
            <div className="hub-aside-meta"><span>{suggested.time}</span></div>
            <button className="hub-aside-cta" onClick={() => setOpen(suggested.id)}>
              Начать <GlyphArrow />
            </button>
          </div>
        </div>

        {GROUPS.map(group => {
          const exs = group.ids.map(id => EXERCISES.find(e => e.id === id)!);
          return (
            <section key={group.id}>
              <div className="group-head">
                <span className="group-num">{group.num}</span>
                <span className="group-title">{group.title}</span>
                <span className="group-desc">{group.desc}</span>
              </div>
              <div className={'ex-grid ' + (exs.length === 1 ? 'ex-grid--single' : '')}>
                {exs.map(ex => {
                  const s = stats[ex.id];
                  return (
                    <div key={ex.id} className="ex-card" onClick={() => setOpen(ex.id)}>
                      <div className="ex-card-glyph" style={{ color: ex.color }}><ExGlyph id={ex.id} /></div>
                      <div className="ex-card-body">
                        <div className="ex-card-eyebrow" style={{ color: ex.color }}>№ {ex.num} · {ex.eyebrow}</div>
                        <h3 className="ex-card-title">{ex.title}</h3>
                        <p className="ex-card-desc">{ex.desc}</p>
                        <div className="ex-card-meta">
                          <span>{ex.time}</span>
                          {s ? (<>
                            <span>·</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--c-moss)', display: 'inline-block' }} />
                              {fmtCount(s.count, 'запис')} · {fmtAgo(s.lastDone)}
                            </span>
                          </>) : <><span>·</span><span>не начато</span></>}
                        </div>
                      </div>
                      <span className="ex-card-arrow">›</span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ExGlyph({ id }: { id: ExId }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (id === 'belief') return <svg viewBox="0 0 28 28" {...s}><path d="M14 4v20"/><path d="M6 7l-3 6h6l-3-6z"/><path d="M22 7l-3 6h6l-3-6z"/><path d="M5 24h18"/></svg>;
  if (id === 'schema') return <svg viewBox="0 0 28 28" {...s}><rect x="4" y="6" width="20" height="16" rx="2"/><path d="M4 12h20"/><path d="M9 18h6"/></svg>;
  if (id === 'mode')   return <svg viewBox="0 0 28 28" {...s}><circle cx="14" cy="14" r="9"/><circle cx="14" cy="14" r="4"/><path d="M14 5v3M14 20v3M5 14h3M20 14h3"/></svg>;
  if (id === 'letter') return <svg viewBox="0 0 28 28" {...s}><path d="M6 8h16v12a2 2 0 01-2 2H8a2 2 0 01-2-2V8z"/><path d="M6 8l8 7 8-7"/></svg>;
  if (id === 'safe')   return <svg viewBox="0 0 28 28" {...s}><path d="M5 13l9-7 9 7v9a1 1 0 01-1 1h-5v-7h-6v7H6a1 1 0 01-1-1v-9z"/></svg>;
  return <svg viewBox="0 0 28 28" {...s}><circle cx="14" cy="14" r="9"/><path d="M14 5v18M5 14h18M7.5 7.5l13 13M20.5 7.5l-13 13"/></svg>;
}
