import { useMemo, useState } from 'react';
import type { FlowNode } from './modeMapFlow';
import type { ModeMapNode, ModeMapKind } from '../api';
import { pickTips } from './modeMapTips';

interface Props {
  nodes: FlowNode[];
  kind: ModeMapKind;
  onAdd: (node: Omit<ModeMapNode, 'position'>) => void;
  onOpenNeed: () => void;
  onClose: () => void;
}

function has(nodes: FlowNode[], type: string) {
  return nodes.some(n => n.type === type);
}

type Step = {
  ok: boolean;
  label: string;
  desc: string;                                  // clinical meaning of this step
  add: Omit<ModeMapNode, 'position'> | null;     // node to drop when clicked
  action?: () => void;                           // alternative click action (e.g. open a field)
  actionReady?: boolean;                         // is the action available yet
};

function mk(type: ModeMapNode['type'], label: string, extra: Partial<ModeMapNode['data']> = {}): Omit<ModeMapNode, 'position'> {
  return { id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type, data: { label, ...extra } };
}

export function ModeMapGuide({ nodes, kind, onAdd, onOpenNeed, onClose }: Props) {
  const hasTrigger = has(nodes, 'trigger');
  const hasChild   = has(nodes, 'child');
  const hasCritic  = has(nodes, 'critic');
  const hasCoping  = has(nodes, 'coping');
  const hasHealthy = has(nodes, 'healthy');
  const hasBehavior = has(nodes, 'behavior');
  const hasNeed    = nodes.some(n => (n.data as { unmetNeed?: string }).unmetNeed);

  // ── Steps with clinical descriptions ────────────────────────────────────────
  const steps: Step[] = kind === 'problem'
    ? [
        { ok: hasTrigger,  label: 'Триггер',          desc: 'Что запустило цикл: ситуация, слова, воспоминание, ощущение в теле',
          add: mk('trigger', 'Триггер') },
        { ok: hasChild,    label: 'Уязвимый Ребёнок',  desc: 'Боль под поверхностью — страх, стыд, одиночество, беспомощность',
          add: mk('child', 'Уязвимый Ребёнок') },
        { ok: hasCritic,   label: 'Критик',            desc: 'Внутренний голос, который атакует ребёнка и усиливает боль',
          add: mk('critic', 'Критик') },
        { ok: hasCoping,   label: 'Копинг',            desc: 'Как защищается: избегание / капитуляция / гиперкомпенсация',
          add: mk('coping', 'Копинг', { copingSubtype: 'avoid' }) },
        { ok: hasBehavior, label: 'Поведение',         desc: 'Что человек реально делает — и к каким последствиям это ведёт',
          add: mk('behavior', 'Поведение') },
        { ok: hasNeed,     label: 'Потребность',       desc: hasChild
            ? 'Что на самом деле было нужно ребёнку — нажми, чтобы вписать на режиме Ребёнка'
            : 'Что было нужно ребёнку — сначала добавь Уязвимого Ребёнка',
          add: null, action: onOpenNeed, actionReady: hasChild },
      ]
    : [
        { ok: hasChild,   label: 'Детские режимы',     desc: 'Уязвимая, сердитая, импульсивная части — где живёт боль и потребности',
          add: mk('child', 'Уязвимый Ребёнок') },
        { ok: hasCritic,  label: 'Критикующие',        desc: 'Внутренние голоса родителей: требуют, наказывают, внушают вину',
          add: mk('critic', 'Критик') },
        { ok: hasCoping,  label: 'Копинги',            desc: 'Стратегии выживания, которые когда-то спасали, а теперь мешают',
          add: mk('coping', 'Копинг', { copingSubtype: 'avoid' }) },
        { ok: hasHealthy, label: 'Здоровый Взрослый',  desc: 'Заботливая часть: защищает ребёнка, ставит границы критику',
          add: mk('healthy', 'Здоровый Взрослый') },
      ];

  // ── Advice — contextual nudges + fresh random tips from the 50-tip base ──────
  const [reroll, setReroll] = useState(0);
  // Contextual nudges depend on the current map state
  const contextual: string[] = [];
  if (hasCoping && !hasChild)
    contextual.push('За копингом обычно прячется боль Уязвимого Ребёнка. Какую эмоцию он транслирует?');
  if (kind === 'problem' && hasChild && hasCoping && !hasNeed)
    contextual.push('Назови потребность ребёнка — именно она становится целью терапии.');
  if (nodes.length > 12)
    contextual.push('Многовато режимов. Карта показывает то, что участвует в ситуации, а не все режимы сразу.');
  // Fresh random picks — new set each time the panel opens or you reroll
  const random = useMemo(
    () => pickTips(kind, Math.max(1, 4 - contextual.length), contextual),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, reroll, contextual.length],
  );
  const tips = [...contextual, ...random];

  return (
    <div style={{
      width: 264, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto',
      background: 'var(--bg-elev)', border: '1px solid rgba(var(--fg-rgb),0.1)',
      borderRadius: 9, padding: '12px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontSize: 12.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)' }}>
          {kind === 'problem' ? 'Цепочка цикла' : 'Карта личности'}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12, padding: 0 }}>✕</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10, lineHeight: 1.4 }}>
        {kind === 'problem'
          ? 'Триггер → боль → защита → последствия → потребность. Нажми на шаг, чтобы добавить его на холст.'
          : 'Основные группы режимов клиента. Нажми, чтобы добавить недостающий.'}
      </div>

      {/* Numbered steps with clinical descriptions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((s, i) => {
          const clickable = !s.ok && (!!s.add || (!!s.action && s.actionReady));
          return (
            <button key={i} disabled={!clickable}
              onClick={() => { if (!clickable) return; if (s.add) onAdd(s.add); else s.action?.(); }}
              title={clickable ? (s.add ? 'Добавить на холст' : 'Открыть поле') : undefined}
              style={{ display: 'flex', gap: 8, textAlign: 'left', width: '100%',
                background: 'none', border: 'none', padding: '6px 5px', borderRadius: 6,
                cursor: clickable ? 'pointer' : 'default', alignItems: 'flex-start' }}
              onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'rgba(var(--fg-rgb),0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
              <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', fontSize: 10.5, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                background: s.ok ? 'var(--accent-green)' : clickable ? 'var(--accent-soft)' : 'rgba(var(--fg-rgb),0.06)',
                color: s.ok ? '#fff' : clickable ? 'var(--accent)' : 'var(--text-faint)' }}>
                {s.ok ? '✓' : clickable ? (s.add ? '＋' : '✎') : i + 1}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: s.ok ? 'var(--text)' : 'var(--text-sub)' }}>
                  {i + 1}. {s.label}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.35, marginTop: 1 }}>
                  {s.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Advice */}
      <div style={{ borderTop: '1px solid rgba(var(--fg-rgb),0.08)', marginTop: 10, paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)' }}>
            Советы
          </span>
          <button onClick={() => setReroll(r => r + 1)} title="Другие советы"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 13, padding: 0, lineHeight: 1 }}>
            ↻
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tips.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11.5, color: 'var(--text-sub)', lineHeight: 1.4 }}>
              <span style={{ flexShrink: 0 }}>💡</span><span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
