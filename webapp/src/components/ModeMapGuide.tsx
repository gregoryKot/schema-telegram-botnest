import type { FlowNode } from './modeMapFlow';
import type { ModeMapNode, ModeMapKind } from '../api';

interface Props {
  nodes: FlowNode[];
  kind: ModeMapKind;
  onAdd: (node: Omit<ModeMapNode, 'position'>) => void;
  onClose: () => void;
}

function has(nodes: FlowNode[], type: string) {
  return nodes.some(n => n.type === type);
}

type ChainItem = {
  ok: boolean; label: string;
  // node to add when clicked (null = not a node, e.g. a property)
  add: Omit<ModeMapNode, 'position'> | null;
};

function mk(type: ModeMapNode['type'], label: string, extra: Partial<ModeMapNode['data']> = {}): Omit<ModeMapNode, 'position'> {
  return { id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type, data: { label, ...extra } };
}

export function ModeMapGuide({ nodes, kind, onAdd, onClose }: Props) {
  const hasTrigger = has(nodes, 'trigger');
  const hasChild   = has(nodes, 'child');
  const hasCritic  = has(nodes, 'critic');
  const hasCoping  = has(nodes, 'coping');
  const hasHealthy = has(nodes, 'healthy');
  const hasNeed    = nodes.some(n => (n.data as { unmetNeed?: string }).unmetNeed);
  const hasBehavior = has(nodes, 'behavior');

  const chain: ChainItem[] = kind === 'problem'
    ? [
        { ok: hasTrigger,  label: 'Триггер (что запустило)',     add: mk('trigger', 'Триггер') },
        { ok: hasChild,    label: 'Уязвимый Ребёнок (боль)',     add: mk('child', 'Уязвимый Ребёнок') },
        { ok: hasCoping,   label: 'Копинг (как защищается)',     add: mk('coping', 'Копинг', { copingSubtype: 'avoid' }) },
        { ok: hasBehavior, label: 'Поведение (что сделал)',      add: mk('behavior', 'Поведение') },
        { ok: hasNeed,     label: 'Потребность ребёнка',         add: null },
      ]
    : [
        { ok: hasChild,   label: 'Детский режим',      add: mk('child', 'Уязвимый Ребёнок') },
        { ok: hasCritic,  label: 'Критикующий режим',  add: mk('critic', 'Критик') },
        { ok: hasCoping,  label: 'Копинг-режим',       add: mk('coping', 'Копинг', { copingSubtype: 'avoid' }) },
        { ok: hasHealthy, label: 'Здоровый Взрослый',  add: mk('healthy', 'Здоровый Взрослый') },
      ];

  const warnings: string[] = [];
  if (hasCoping && !hasChild)
    warnings.push('За копингом обычно прячется боль Уязвимого Ребёнка — какую эмоцию он транслирует?');
  if (nodes.length > 12)
    warnings.push('Многовато режимов. Карта показывает то, что участвует в проблеме, а не все режимы.');
  if (kind === 'problem' && hasChild && hasCoping && !hasNeed)
    warnings.push('Назови неудовлетворённую потребность ребёнка — именно она становится целью терапии.');
  if (hasHealthy)
    warnings.push('Покажи Здорового Взрослого активным: кого защищает, кому ставит границы.');

  return (
    <div style={{
      width: 250, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto',
      background: 'var(--bg-elev)', border: '1px solid rgba(var(--fg-rgb),0.1)',
      borderRadius: 9, padding: '12px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontSize: 12.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)' }}>
          {kind === 'problem' ? 'Цепочка цикла' : 'Основные режимы'}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12, padding: 0 }}>✕</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 9, lineHeight: 1.35 }}>
        {kind === 'problem' ? 'Чего не хватает — нажми, чтобы добавить на холст' : 'Какие основные режимы уже на карте'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: warnings.length ? 12 : 0 }}>
        {chain.map((c, i) => {
          const clickable = !c.ok && c.add;
          return (
            <button key={i} disabled={!clickable}
              onClick={() => clickable && c.add && onAdd(c.add)}
              title={clickable ? 'Добавить на холст' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 7, textAlign: 'left', width: '100%',
                background: 'none', border: 'none', padding: '4px 5px', borderRadius: 5,
                cursor: clickable ? 'pointer' : 'default' }}
              onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'rgba(var(--fg-rgb),0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
              <span style={{ fontSize: 12, width: 14, color: c.ok ? 'var(--accent-green)' : clickable ? 'var(--accent)' : 'var(--text-ghost)' }}>
                {c.ok ? '✓' : clickable ? '＋' : '○'}
              </span>
              <span style={{ color: c.ok ? 'var(--text)' : 'var(--text-sub)', flex: 1 }}>{c.label}</span>
            </button>
          );
        })}
      </div>

      {warnings.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(var(--fg-rgb),0.08)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {warnings.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11.5, color: 'var(--text-sub)', lineHeight: 1.4 }}>
              <span style={{ flexShrink: 0 }}>💡</span><span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
