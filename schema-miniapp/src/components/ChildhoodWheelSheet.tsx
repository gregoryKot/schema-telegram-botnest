import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { api } from '../api';
import { COLORS } from '../types';
import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { TherapyNote } from './TherapyNote';

export const CHILDHOOD_DONE_KEY = 'childhood_wheel_done';

export function shouldShowChildhoodWheel(): boolean {
  return !localStorage.getItem(CHILDHOOD_DONE_KEY);
}

const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'] as const;
type NeedId = typeof NEED_IDS[number];

const NEED_META: Record<NeedId, {
  label: string; emoji: string; question: string;
  anchorLow: string; anchorHigh: string;
  examples: Array<{ score: number; text: string }>;
}> = {
  attachment: {
    label: 'Привязанность',
    emoji: '🤝',
    question: 'Как часто, когда тебе было плохо, рядом оказывался взрослый который это замечал и откликался?',
    anchorLow: 'Взрослый отсутствовал или был непредсказуем. В трудный момент некому было обратиться. Было ощущение что ты лишний или нежеланный.',
    anchorHigh: 'Был стабильный взрослый, которому можно было доверять. Он замечал когда что-то не так и приходил. Ты чувствовал себя нужным и принятым.',
    examples: [
      { score: 2, text: 'Мама пила. Физически была дома, но эмоционально — нигде. Когда было страшно или плохо — шёл в свою комнату и справлялся один. Обнимала редко и только когда настроение совпадало. Плакать было некому.' },
      { score: 4, text: 'Отец ушёл из семьи когда было 3 года. Бабушка появлялась два-три раза в неделю — с ней было тепло и надёжно. Но её было мало, а мать была непредсказуемой: иногда обнимала, иногда срывалась без причины. Никогда не знал чего ждать.' },
      { score: 7, text: 'Мама была заботливой, но очень занятой — работала на двух работах. Если было плохо — слушала, но быстро. Серьёзные разговоры редко доходили до конца. Не чувствовал себя брошенным, но и по-настоящему понятым — тоже редко.' },
      { score: 9, text: 'Когда падал — мама приходила. Когда страшно — можно было зайти к родителям ночью, и это было нормально. Конфликты случались, но всегда заканчивались примирением. Помню себя нужным и принятым.' },
    ],
  },
  autonomy: {
    label: 'Автономия',
    emoji: '🧭',
    question: 'Насколько тебе доверяли — право иметь своё мнение, делать выборы по возрасту, справляться самому и ошибаться без катастрофы?',
    anchorLow: 'Тебя контролировали, решали за тебя, критиковали или не доверяли. Ошибка была катастрофой. Самостоятельность не поощрялась.',
    anchorHigh: 'Поощряли пробовать самому. Мнение уважали. Ошибки были частью взросления, а не поводом для стыда или наказания.',
    examples: [
      { score: 2, text: 'Мать решала всё — что надеть, с кем дружить, куда поступать. За ошибки стыдили или наказывали. «Что люди скажут» было важнее чем то, что я хочу. Пробовать что-то своё без разрешения было страшно.' },
      { score: 4, text: 'Отец говорил «сам решай» — но потом критиковал любой выбор. Хвалили только когда делал как он хочет. Свобода была на словах. На деле — научился угадывать «правильный» ответ, а не искать свой.' },
      { score: 7, text: 'В целом давали выбирать. Но в старших классах давление усилилось: успевай, старайся, не подведи. Мнение уважали в мелочах, в важных вещах — решали за меня. Ошибаться было можно, но не совсем спокойно.' },
      { score: 9, text: 'Ошибка воспринималась как нормальная часть роста. Мог сказать «нет» и это не кончалось скандалом. Выбор профессии остался за мной — даже когда родители были не согласны. Доверяли что справлюсь.' },
    ],
  },
  expression: {
    label: 'Выражение чувств',
    emoji: '💬',
    question: 'Насколько безопасно было выражать злость, страх, грусть или несогласие — без наказания, игнорирования или стыда?',
    anchorLow: 'Сильные чувства было опасно показывать: наказывали, игнорировали или стыдили. Научился прятать или подавлять то, что чувствуешь.',
    anchorHigh: 'Можно было плакать, злиться, бояться. Чувства принимались как норма. О своих переживаниях можно было говорить открыто.',
    examples: [
      { score: 2, text: '«Не реви», «не злись», «не выдумывай». Злость каралась, страх высмеивался, грусть игнорировалась. Выучил одно правило: чувства — личное дело, наружу не выносить. Стал «удобным» ребёнком.' },
      { score: 4, text: 'Мама слушала если был расстроен. Но моя злость её пугала — сразу закрывалась или сама начинала плакать. Радоваться можно было, а горевать долго — неловко. Чувства допускались, но в «удобных» дозах.' },
      { score: 7, text: 'В семье о чувствах говорили, но поверхностно. «Как ты?» — спрашивали, но настоящий ответ слышать не всегда были готовы. Не запрещали, но и не приглашали идти глубже. Научился фильтровать что показывать.' },
      { score: 9, text: 'Мог сказать маме что злюсь на неё — и разговор не обрывался. Слёзы воспринимались нормально. Если чувствовал что-то сложное — был человек который мог выдержать это рядом, не уходя и не паникуя.' },
    ],
  },
  play: {
    label: 'Спонтанность',
    emoji: '🎉',
    question: 'Насколько в детстве было место для игры, лёгкости и радости — без постоянного давления, тревоги или чувства что надо быть продуктивным?',
    anchorLow: 'Давление выполнять, достигать, быть серьёзным. Беззаботность вызывала чувство вины. Взрослые рядом были тревожными или холодными.',
    anchorHigh: 'Было место для игры ради игры. Взрослые умели быть спонтанными. Смех и лёгкость были частью обычной жизни.',
    examples: [
      { score: 2, text: 'Каждая минута должна была быть «полезной»: уроки, кружки, дела по дому. Просто лежать и читать — лень. Родители жили в постоянной тревоге — смех в доме был редкостью. Беззаботность вызывала чувство вины.' },
      { score: 4, text: 'Играть давали, но игра должна была быть «полезной». Шахматы — хорошо, просто возиться с конструктором — «займись чем-нибудь». Летом — свобода, в учебный год — постоянное давление. Лёгкость была сезонной.' },
      { score: 7, text: 'Детство в целом было нормальным: двор, каникулы, игры. Но родители сами были немного скованными — не помню чтобы кто-то из них дурачился или смеялся в голос. Веселье было, спонтанности — меньше.' },
      { score: 9, text: 'Родители умели быть глупыми. Отец мог затеять снежную битву просто так. Дома было место для смеха и лёгкости без повода. Помню детство как пространство где можно было быть собой — не зарабатывая это.' },
    ],
  },
  limits: {
    label: 'Границы',
    emoji: '⚖️',
    question: 'Насколько правила в семье были последовательными — понятными, справедливыми и устойчивыми, а не случайными, жестокими или отсутствующими?',
    anchorLow: 'Правила были непредсказуемы, слишком жёсткими (страх, жёсткие наказания) или почти отсутствовали. Не было ощущения стабильной структуры.',
    anchorHigh: 'Правила были понятны и объяснены. Нарушения имели соразмерные последствия. Взрослые держали границы — с теплом, не с жёсткостью.',
    examples: [
      { score: 2, text: 'Отец пил — и правила менялись вместе с его настроением. Одно и то же сегодня игнорировалось, завтра каралось жёстко. Никогда не понимал по каким законам мы живём. Постоянно был наготове — вдруг что-то не так.' },
      { score: 4, text: 'Правила вроде были, но применялись когда настроение плохое — тогда всё замечалось и всё было поводом. Если настроение хорошее — можно почти всё. Структура была на бумаге, на деле — непредсказуемость.' },
      { score: 7, text: 'Правила в целом были понятны. Но иногда родители сами их нарушали или делали исключения без объяснений. За одно и то же могли и не заметить, и строго наказать. Структура была, но с дырами.' },
      { score: 9, text: 'Знал что можно, а что нет — и почему. Если нарушал — было соразмерное последствие, не катастрофа. Родители держали слово. Граница была — но с теплом, без страха. Мог предсказать как будет.' },
    ],
  },
};

// Схемы, которые могут формироваться при дефиците каждой потребности
const SCHEMA_HINTS: Record<NeedId, { domain: string; color: string; schemas: string[] }> = {
  attachment: {
    domain: 'Отчуждение и отвержение',
    color: 'var(--accent-red)',
    schemas: ['Покинутость / Нестабильность', 'Недоверие', 'Эмоциональная депривация', 'Дефективность / Стыд'],
  },
  autonomy: {
    domain: 'Нарушение автономии',
    color: 'var(--accent-orange)',
    schemas: ['Зависимость / Беспомощность', 'Неуспешность', 'Спутанность / Неразвитая идентичность'],
  },
  expression: {
    domain: 'Ориентация на других + Бдительность',
    color: 'var(--accent-green)',
    schemas: ['Покорность', 'Самопожертвование', 'Страх потери контроля над эмоциями', 'Эмоциональная скованность', 'Поиск одобрения'],
  },
  play: {
    domain: 'Бдительность и подавление',
    color: 'var(--accent-indigo)',
    schemas: ['Жёсткие стандарты / Придирчивость', 'Негативизм / Пессимизм', 'Пунитивность (на себя)', 'Пунитивность (на других)'],
  },
  limits: {
    domain: 'Нарушение границ',
    color: 'var(--accent-yellow)',
    schemas: ['Привилегированность / Грандиозность', 'Недостаточность самоконтроля'],
  },
};

function ChildhoodWheel({ ratings }: { ratings: Record<NeedId, number> }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 80;
  const angles = useMemo(
    () => NEED_IDS.map((_, i) => (i * 2 * Math.PI / 5) - Math.PI / 2),
    []
  );
  const valuePoints = NEED_IDS.map((id, i) => {
    const r = (ratings[id] / 10) * maxR;
    return `${(cx + r * Math.cos(angles[i])).toFixed(1)},${(cy + r * Math.sin(angles[i])).toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <polygon key={pct}
          points={angles.map(a => `${(cx + maxR * pct * Math.cos(a)).toFixed(1)},${(cy + maxR * pct * Math.sin(a)).toFixed(1)}`).join(' ')}
          fill="none" stroke="rgba(var(--fg-rgb),0.06)" strokeWidth={1}
        />
      ))}
      {/* Axis lines */}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy}
          x2={(cx + maxR * Math.cos(a)).toFixed(1)} y2={(cy + maxR * Math.sin(a)).toFixed(1)}
          stroke="rgba(var(--fg-rgb),0.07)" strokeWidth={1}
        />
      ))}
      {/* Value polygon */}
      <polygon points={valuePoints} fill="color-mix(in srgb, var(--accent) 18%, transparent)" stroke="#a78bfa" strokeWidth={1.5} strokeLinejoin="round" />
      {/* Per-need dots + value labels */}
      {NEED_IDS.map((id, i) => {
        const r = (ratings[id] / 10) * maxR;
        const color = COLORS[id] ?? '#888';
        const dotX = cx + r * Math.cos(angles[i]);
        const dotY = cy + r * Math.sin(angles[i]);
        const labelR = maxR + 22;
        const labelX = cx + labelR * Math.cos(angles[i]);
        const labelY = cy + labelR * Math.sin(angles[i]);
        return (
          <g key={id}>
            <circle cx={dotX.toFixed(1)} cy={dotY.toFixed(1)} r={4} fill={color} />
            <text x={labelX.toFixed(1)} y={labelY.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={13} style={{ userSelect: 'none' }}>
              {NEED_META[id].emoji}
            </text>
            <text x={labelX.toFixed(1)} y={(labelY + 14).toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fill={color} fontWeight={600} style={{ userSelect: 'none' }}>
              {ratings[id]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Slider({ value, color, onChange }: { value: number; color: string; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    return () => el.removeEventListener('touchstart', prevent);
  }, []);
  const pct = value * 10;

  const calcValue = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    onChange(Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 10));
  }, [onChange]);

  const onPtrDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    calcValue(e.clientX);
  }, [calcValue]);

  const onPtrMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    calcValue(e.clientX);
  }, [calcValue]);

  return (
    <div ref={trackRef} onPointerDown={onPtrDown} onPointerMove={onPtrMove}
      style={{ position: 'relative', padding: '12px 0', cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}>
      <div style={{ height: 6, borderRadius: 6, background: 'rgba(var(--fg-rgb),0.07)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: `linear-gradient(to right, ${color}55, ${color})` }} />
      </div>
      <div style={{
        position: 'absolute', left: `${pct}%`, top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 20, height: 20, borderRadius: '50%',
        background: color, border: '2px solid var(--bg)', pointerEvents: 'none',
      }} />
    </div>
  );
}

type Phase = 'intro' | 'fill' | 'result';

interface Props {
  onClose: () => void;
  onOpenSchemas: () => void;
  onSaved?: (ratings: Record<string, number>) => void;
}

export function ChildhoodWheelSheet({ onClose, onOpenSchemas, onSaved }: Props) {
  const alreadyDone = !!localStorage.getItem(CHILDHOOD_DONE_KEY);
  const [phase, setPhase] = useState<Phase>(alreadyDone ? 'result' : 'intro');
  const [activeSchema, setActiveSchema] = useState<{ name: string; desc: string; color: string } | null>(null);
  const [ratings, setRatings] = useState<Record<NeedId, number>>({
    attachment: 5, autonomy: 5, expression: 5, play: 5, limits: 5,
  });
  const [saving, setSaving] = useState(false);
  const [openExampleId, setOpenExampleId] = useState<NeedId | null>(null);
  const [openExampleIdx, setOpenExampleIdx] = useState<number | null>(null);

  useEffect(() => {
    if (alreadyDone) {
      api.getChildhoodRatings().then(saved => {
        setRatings(prev => ({ ...prev, ...(saved as Record<NeedId, number>) }));
      }).catch(() => {});
    }
  }, []);

  const lowNeeds = NEED_IDS.filter(id => ratings[id] <= 4);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    // Save locally first so UI never gets stuck
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    onSaved?.(ratings as Record<string, number>);
    setPhase('result');
    setSaving(false);
    // Sync to server in background
    api.saveChildhoodRatings(ratings as Record<string, number>).catch(() => {});
  }

  function finish() {
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    onClose();
  }

  return (
    <>
    <BottomSheet onClose={finish} zIndex={200}>

      {/* ── INTRO ── */}
      {phase === 'intro' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 4 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🌱</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: 10 }}>
              Колесо детства
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7 }}>
              Те же пять потребностей — но про детство.
            </div>
          </div>

          <div style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)', borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.75 }}>
              В схема-терапии считается, что схемы формируются когда базовые потребности{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>систематически не удовлетворялись в детстве</span>.
              Это упражнение поможет увидеть, какие области могут быть особенно чувствительными — и почему дневник сегодня показывает то, что показывает.
            </div>
          </div>

          <div style={{ background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 14, padding: '12px 16px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>
              Это не диагностика. Оценки приблизительны и субъективны. Результаты — для твоего понимания, не для выводов.
            </div>
          </div>

          <button
            onClick={() => setPhase('fill')}
            style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #a78bfa, #4fa3f7)', color: 'var(--text)', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}
          >
            Оценить детство — 2 минуты
          </button>
          <button onClick={finish} style={{ width: '100%', padding: '12px 0', borderRadius: 14, border: 'none', background: 'transparent', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer' }}>
            Пропустить
          </button>
        </div>
      )}

      {/* ── FILL ── */}
      {phase === 'fill' && (
        <div>
          {/* Idealization warning */}
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 14, padding: '12px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-yellow)', marginBottom: 4 }}>⚠️ Осторожно: защитная идеализация</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.65 }}>
              Психика защищает нас от боли — поэтому мы склонны помнить хорошее и не замечать систематические паттерны.
              Оценивай <em>не отдельные моменты</em>, а то <em>как было в целом, большую часть времени</em>.
              Под каждым ползунком — описания крайностей, а по кнопке <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(var(--fg-rgb),0.12)', fontSize: 10, fontWeight: 700, color: 'var(--text-sub)', verticalAlign: 'middle' }}>?</span> — реальные примеры из жизни. Сравни с ними.
            </div>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.5 }}>
            0 — совсем нет, 10 — в полной мере
          </div>

          {NEED_IDS.map(id => {
            const meta = NEED_META[id];
            const color = COLORS[id] ?? '#888';
            const value = ratings[id];
            const showLow = value <= 5;
            const showHigh = value >= 5;
            return (
              <div key={id} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {meta.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{meta.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2, lineHeight: 1.4 }}>{meta.question}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => { setOpenExampleId(openExampleId === id ? null : id); setOpenExampleIdx(null); }}
                      style={{
                        width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: openExampleId === id ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'rgba(var(--fg-rgb),0.08)',
                        color: openExampleId === id ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.35)',
                        fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                    >?</button>
                    <div style={{ fontSize: 16, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>
                      {value}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-sub)' }}>/10</span>
                    </div>
                  </div>
                </div>
                <Slider value={value} color={color} onChange={v => setRatings(prev => ({ ...prev, [id]: v }))} />
                {/* Anchors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                  <div style={{
                    fontSize: 11, lineHeight: 1.55, padding: '7px 9px', borderRadius: 10,
                    background: showLow && value <= 4 ? 'color-mix(in srgb, var(--accent-red) 10%, transparent)' : 'rgba(var(--fg-rgb),0.03)',
                    color: showLow && value <= 4 ? 'color-mix(in srgb, var(--accent-red) 75%, transparent)' : 'rgba(var(--fg-rgb),0.25)',
                    border: showLow && value <= 4 ? '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}>
                    <span style={{ fontWeight: 600, display: 'block', marginBottom: 2 }}>0 — дефицит</span>
                    {meta.anchorLow}
                  </div>
                  <div style={{
                    fontSize: 11, lineHeight: 1.55, padding: '7px 9px', borderRadius: 10,
                    background: showHigh && value >= 8 ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)' : 'rgba(var(--fg-rgb),0.03)',
                    color: showHigh && value >= 8 ? 'color-mix(in srgb, var(--accent-green) 75%, transparent)' : 'rgba(var(--fg-rgb),0.25)',
                    border: showHigh && value >= 8 ? '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}>
                    <span style={{ fontWeight: 600, display: 'block', marginBottom: 2 }}>10 — насыщение</span>
                    {meta.anchorHigh}
                  </div>
                </div>
                {/* Examples panel */}
                {openExampleId === id && (
                  <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)' }}>
                    <div style={{ padding: '8px 12px', background: 'color-mix(in srgb, var(--accent) 8%, transparent)', fontSize: 11, color: 'var(--text-sub)', fontWeight: 500 }}>
                      Примеры — как это выглядит в жизни
                    </div>
                    {meta.examples.map((ex, i) => {
                      const badgeColor = ex.score <= 3 ? 'var(--accent-red)' : ex.score < 8 ? 'var(--accent-yellow)' : 'var(--accent-green)';
                      const isOpen = openExampleIdx === i;
                      return (
                        <div
                          key={i}
                          onClick={() => setOpenExampleIdx(isOpen ? null : i)}
                          style={{
                            padding: '10px 12px', cursor: 'pointer',
                            borderTop: i === 0 ? 'none' : '1px solid rgba(var(--fg-rgb),0.05)',
                            background: isOpen ? 'rgba(var(--fg-rgb),0.04)' : 'rgba(var(--fg-rgb),0.02)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                              background: badgeColor + '22', color: badgeColor, flexShrink: 0,
                            }}>≈{ex.score}/10</span>
                            <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>
                              {isOpen ? '▴' : '▾'}
                            </span>
                          </div>
                          {isOpen && (
                            <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, marginTop: 8 }}>
                              {ex.text}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', background: saving ? 'rgba(var(--fg-rgb),0.1)' : 'linear-gradient(135deg, #a78bfa, #4fa3f7)', color: 'var(--text)', fontSize: 16, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}
          >
            {saving ? '...' : 'Посмотреть результат'}
          </button>
        </div>
      )}

      {/* ── RESULT ── */}
      {phase === 'result' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Твоё колесо детства</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
              Сравнение отобразится в разделе История поверх дневника
            </div>
          </div>

          {/* Wheel */}
          <div style={{ marginBottom: 20 }}>
            <ChildhoodWheel ratings={ratings} />
          </div>

          {/* Compact score legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            {NEED_IDS.map(id => {
              const value = ratings[id];
              const color = COLORS[id] ?? '#888';
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13 }}>{NEED_META[id].emoji}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>{NEED_META[id].label.split(' ')[0]}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: value <= 4 ? 'var(--accent-red)' : value <= 6 ? 'var(--accent-yellow)' : color }}>{value}</span>
                </div>
              );
            })}
          </div>

          {/* Schema hints for low needs */}
          {lowNeeds.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionLabel>Возможные активные схемы</SectionLabel>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 12, lineHeight: 1.6 }}>
                Когда потребность хронически не удовлетворялась в детстве, психика вырабатывает стратегии выживания. Это и есть схемы — не диагноз, а паттерн, который когда-то помогал.
              </div>
              {lowNeeds.map(id => {
                const meta = NEED_META[id];
                const hint = SCHEMA_HINTS[id];
                return (
                  <div key={id} style={{ background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 14, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 14 }}>{meta.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{meta.label}</span>
                      <span style={{ fontSize: 12, color: hint.color, marginLeft: 'auto' }}>{ratings[id]}/10 в детстве</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 6 }}>Домен: {hint.domain}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {hint.schemas.map(s => {
                        const schemaData = SCHEMA_DOMAINS.flatMap(d => d.schemas.map(sc => ({ ...sc, color: d.color }))).find(sc => sc.name === s);
                        return (
                          <span
                            key={s}
                            onClick={() => schemaData && setActiveSchema(schemaData)}
                            style={{
                              fontSize: 11, padding: '3px 10px', borderRadius: 20,
                              background: hint.color + '18', color: hint.color,
                              cursor: schemaData ? 'pointer' : 'default',
                              textDecoration: schemaData ? 'underline dotted' : 'none',
                              textUnderlineOffset: 3,
                            }}
                          >
                            {s}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div
                onClick={() => { finish(); onOpenSchemas(); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: 14, padding: '12px 16px', cursor: 'pointer', marginTop: 4 }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)' }}>Подробнее о схемах</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>Что они значат и как с ними работать</div>
                </div>
                <span style={{ fontSize: 18, color: 'var(--accent)' }}>›</span>
              </div>
            </div>
          )}

          {lowNeeds.length === 0 && (
            <div style={{ background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', borderRadius: 14, padding: '14px 16px', marginBottom: 24 }}>
              <div style={{ fontSize: 14, color: 'var(--accent-green)', fontWeight: 500, marginBottom: 6 }}>Хорошее детство по всем зонам</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                Все потребности выше 4/10 — это редкость и ресурс. Если сейчас что-то низкое, скорее всего это ситуативное, а не схема.
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <TherapyNote compact />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setPhase('fill')}
              style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: '1px solid rgba(var(--fg-rgb),0.1)', background: 'transparent', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer' }}
            >
              ✎ Изменить
            </button>
            <button
              onClick={finish}
              style={{ flex: 2, padding: '14px 0', borderRadius: 14, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'rgba(var(--fg-rgb),0.7)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Готово
            </button>
          </div>
        </div>
      )}

    </BottomSheet>

    {activeSchema && (
      <BottomSheet onClose={() => setActiveSchema(null)} zIndex={300}>
        <div style={{ paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: activeSchema.color, flexShrink: 0 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{activeSchema.name}</div>
          </div>
          <div style={{ fontSize: 15, color: 'rgba(var(--fg-rgb),0.7)', lineHeight: 1.7 }}>{activeSchema.desc}</div>
        </div>
      </BottomSheet>
    )}
    </>
  );
}
