import type { FlowNode, FlowEdge } from './modeMapFlow';
import type { ModeMapKind } from '../api';

interface Props {
  nodes: FlowNode[];
  edges: FlowEdge[];
  kind: ModeMapKind;
  onClose: () => void;
}

function has(nodes: FlowNode[], type: string) {
  return nodes.some(n => n.type === type);
}

export function ModeMapGuide({ nodes, edges, kind, onClose }: Props) {
  const hasTrigger = has(nodes, 'trigger');
  const hasChild   = has(nodes, 'child');
  const hasCritic  = has(nodes, 'critic');
  const hasCoping  = has(nodes, 'coping');
  const hasHealthy = has(nodes, 'healthy');
  const hasNeed    = nodes.some(n => (n.data as { unmetNeed?: string }).unmetNeed);
  const copingIds  = new Set(nodes.filter(n => n.type === 'coping').map(n => n.id));
  const hasConsequence = edges.some(e => copingIds.has(e.source)); // behaviour follows the coping

  // ── Chain checklist (problem map = the cycle; personality = main modes) ──────
  const chain = kind === 'problem'
    ? [
        { ok: hasTrigger,     label: 'Триггер / ситуация' },
        { ok: hasChild,       label: 'Боль — Уязвимый Ребёнок' },
        { ok: hasCoping,      label: 'Защита — копинг' },
        { ok: hasConsequence, label: 'Последствие / поведение' },
        { ok: hasNeed,        label: 'Неудовлетворённая потребность' },
      ]
    : [
        { ok: hasChild,   label: 'Детский режим' },
        { ok: hasCritic,  label: 'Критикующий режим' },
        { ok: hasCoping,  label: 'Копинг-режим' },
        { ok: hasHealthy, label: 'Здоровый Взрослый' },
      ];

  // ── Warnings ────────────────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (hasCoping && !hasChild)
    warnings.push('За копингом обычно прячется боль Уязвимого Ребёнка. Какую эмоцию он транслирует?');
  if (nodes.length > 12)
    warnings.push('Многовато режимов. Карта показывает то, что участвует в проблеме, а не все режимы.');
  if (kind === 'problem' && hasChild && hasCoping && !hasNeed)
    warnings.push('Назови неудовлетворённую потребность ребёнка — именно она становится целью терапии.');
  if (hasHealthy)
    warnings.push('Покажи Здорового Взрослого активным: кого защищает, кому ставит границы.');

  return (
    <div style={{
      width: 240, background: 'var(--bg-elev)', border: '1px solid rgba(var(--fg-rgb),0.1)',
      borderRadius: 9, padding: '12px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontSize: 12.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)' }}>
          {kind === 'problem' ? 'Цепочка цикла' : 'Основные режимы'}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12, padding: 0 }}>✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: warnings.length ? 12 : 0 }}>
        {chain.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 12, color: c.ok ? 'var(--accent-green)' : 'var(--text-ghost)', width: 14 }}>
              {c.ok ? '✓' : '○'}
            </span>
            <span style={{ color: c.ok ? 'var(--text)' : 'var(--text-faint)' }}>{c.label}</span>
          </div>
        ))}
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
