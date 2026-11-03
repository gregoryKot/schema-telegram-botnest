import { useState } from 'react';
import type { FlowNode } from './modeMapFlow';
import type { ModeMapNode, ModeMapKind } from '../api';
import { useTr } from '../utils/addressForm';
import '../styles/sheet-modemap.css';
import { MMIcon } from './modeMapIcons';
import { GuideTips } from './modeMap/GuideTips';

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
  const tr = useTr();
  const hasTrigger = has(nodes, 'trigger');
  const hasChild   = has(nodes, 'child');
  const hasCritic  = has(nodes, 'critic');
  const hasCoping  = has(nodes, 'coping');
  const hasHealthy = has(nodes, 'healthy');
  const hasBehavior = has(nodes, 'behavior');
  const hasNeed    = nodes.some(n => (n.data as { unmetNeed?: string }).unmetNeed);
  const hasSide = (type: string, side: 'A' | 'B') =>
    nodes.some(n => n.type === type && (n.data as { side?: string }).side === side);

  // ── Steps with clinical descriptions ────────────────────────────────────────
  const steps: Step[] = kind === 'couple'
    ? [
        { ok: hasSide('trigger', 'A'), label: 'Триггер',            desc: 'Что произошло между партнёрами — момент, с которого закрутился цикл',
          add: mk('trigger', 'Триггер', { side: 'A' }) },
        { ok: hasSide('child', 'A'),   label: 'Боль Партнёра А',     desc: 'Что задело А под поверхностью: страх, стыд, покинутость',
          add: mk('child', 'Уязвимый Ребёнок', { side: 'A' }) },
        { ok: hasSide('coping', 'A'),  label: 'Копинг А → бьёт по Б', desc: 'Как защищается А — именно это видит и чувствует партнёр Б',
          add: mk('coping', 'Копинг', { copingSubtype: 'over', side: 'A' }) },
        { ok: hasSide('child', 'B'),   label: 'Боль Партнёра Б',     desc: 'Копинг А задевает рану Б — активируется его Уязвимый Ребёнок',
          add: mk('child', 'Уязвимый Ребёнок', { side: 'B' }) },
        { ok: hasSide('coping', 'B'),  label: 'Копинг Б → бьёт по А', desc: 'Как защищается Б — и круг замыкается, снова запуская А',
          add: mk('coping', 'Копинг', { copingSubtype: 'avoid', side: 'B' }) },
        { ok: hasSide('healthy', 'A') || hasSide('healthy', 'B'), label: 'Здоровые Взрослые', desc: 'Кто первым замечает цикл и выходит из него — точка разрыва',
          add: mk('healthy', 'Здоровый Взрослый', { side: 'A' }) },
      ]
    : kind === 'problem'
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
            ? tr('Что на самом деле было нужно ребёнку — нажми, чтобы вписать на режиме Ребёнка', 'Что на самом деле было нужно ребёнку — нажмите, чтобы вписать на режиме Ребёнка')
            : tr('Что было нужно ребёнку — сначала добавь Уязвимого Ребёнка', 'Что было нужно ребёнку — сначала добавьте Уязвимого Ребёнка'),
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

  // Свёрнутая панель — одна строка с прогрессом: развёрнутая закрывала фигуры и
  // статус сохранения (QA 2026-10-26). На телефоне холст узкий — свёрнута сразу.
  const [min, setMin] = useState(() => window.innerWidth < 768 || localStorage.getItem('modemap_guide_min') === '1');
  const toggleMin = () => setMin(m => { localStorage.setItem('modemap_guide_min', m ? '0' : '1'); return !m; });

  // ── Advice — contextual ALERTS (state-specific) kept apart from random tips ──
  type Alert = { text: string; level: 'warn' | 'info' };
  const alerts: Alert[] = [];
  if (nodes.length > 12)
    alerts.push({ text: 'Многовато режимов. Карта показывает то, что участвует в ситуации, а не все режимы сразу.', level: 'warn' });
  if (hasCoping && !hasChild)
    alerts.push({ text: 'За копингом обычно прячется боль Уязвимого Ребёнка. Какую эмоцию он транслирует?', level: 'info' });
  if (kind === 'problem' && hasChild && hasCoping && !hasNeed)
    alerts.push({ text: tr('Назови потребность ребёнка — именно она становится целью терапии.', 'Назовите потребность ребёнка — именно она становится целью терапии.'), level: 'info' });
  return (
    <div className={`ds-card mm2-guide${min ? ' is-min' : ''}`}>
      <div className="mm2-guide-head">
        <button onClick={toggleMin} aria-expanded={!min} title={min ? 'Развернуть подсказки' : 'Свернуть подсказки'} className="mm2-guide-toggle">
          <span className="ds-label">{kind === 'couple' ? 'Цикл-клэш пары' : kind === 'problem' ? 'Цепочка цикла' : 'Карта личности'}</span>
          <span className="mm2-guide-n">{steps.filter(s => s.ok).length}/{steps.length}</span>
          <MMIcon name="caret" size={12} className={min ? 'mm2-guide-caret is-min' : 'mm2-guide-caret'} />
        </button>
        <button onClick={onClose} aria-label="Закрыть" className="mm2-x"><MMIcon name="close" size={14} /></button>
      </div>
      {!min && <>
      <div className="mm2-guide-lead">
        {kind === 'couple'
          ? tr('Копинг А ранит Б → копинг Б ранит А — порочный круг. Помечай режимы партнёром (А/Б). Нажми на шаг, чтобы добавить его.', 'Копинг А ранит Б → копинг Б ранит А — порочный круг. Помечайте режимы партнёром (А/Б). Нажмите на шаг, чтобы добавить его.')
          : kind === 'problem'
          ? tr('Триггер → боль → защита → последствия → потребность. Нажми на шаг, чтобы добавить его на холст.', 'Триггер → боль → защита → последствия → потребность. Нажмите на шаг, чтобы добавить его на холст.')
          : tr('Основные группы режимов клиента. Нажми, чтобы добавить недостающий.', 'Основные группы режимов клиента. Нажмите, чтобы добавить недостающий.')}
      </div>

      {/* Numbered steps with clinical descriptions */}
      <div>
        {steps.map((s, i) => {
          const clickable = !s.ok && (!!s.add || (!!s.action && s.actionReady));
          return (
            <button key={i} disabled={!clickable}
              onClick={() => { if (!clickable) return; if (s.add) onAdd(s.add); else s.action?.(); }}
              title={clickable ? (s.add ? 'Добавить на холст' : 'Открыть поле') : undefined}
              className={`mm2-step${clickable ? ' is-click' : ''}`}>
              <span className={`mm2-step-n${s.ok ? ' is-done' : clickable ? ' is-click' : ''}`}>
                {s.ok ? '✓' : clickable ? (s.add ? '+' : '✎') : i + 1}
              </span>
              <span>
                <span className={`mm2-step-t${s.ok ? ' is-done' : ''}`}>
                  {i + 1}. {s.label}
                </span>
                <span className="mm2-step-d">{s.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Contextual alerts — what THIS map needs right now (kept separate, colour-coded) */}
      {alerts.length > 0 && (
        <div className="mm2-alerts">
          {alerts.map((a, i) => (
            <div key={i} className={`mm2-alert${a.level === 'warn' ? ' is-warn' : ''}`}>
              <b>{a.level === 'warn' ? '!' : 'i'}</b>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      <GuideTips kind={kind} />
      </>}
    </div>
  );
}
