import type { ReactNode } from 'react';
import { IdentityDot } from '../../components/IdentityDot';
import { needColor } from '../../needs/needColors';
import type { ConceptGraphModel } from './conceptGraphTypes';
import {
  boxStyle,
  chipRowStyle,
  labelStyle,
  miniChipStyle,
} from './graphStyles';

function RootItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...labelStyle, marginBottom: 'var(--space-4)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const dash = <span style={{ color: 'var(--text-faint)' }}>—</span>;
const textStyle = {
  fontSize: 13,
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
} as const;

/** Корни: ранний опыт, неудовлетворённые потребности, схемы. */
export function ConceptRoots({ roots }: { roots: ConceptGraphModel['roots'] }) {
  return (
    <section aria-label="Корни" style={boxStyle}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 'var(--space-8)',
        }}
      >
        Корни
      </div>
      <div
        style={{
          display: 'grid',
          gap: 'var(--space-12)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <RootItem title="Ранний опыт">
          <div style={textStyle}>{roots.experience || dash}</div>
        </RootItem>
        <RootItem title="Неудовлетворённые потребности">
          {roots.unmetNeeds && <div style={textStyle}>{roots.unmetNeeds}</div>}
          {roots.needs.length > 0 && (
            <div style={{ ...chipRowStyle, marginTop: 4 }}>
              {roots.needs.map((n) => (
                <span key={n.id} style={miniChipStyle}>
                  <IdentityDot color={needColor(n.id)} size={6} /> {n.name}
                </span>
              ))}
            </div>
          )}
          {!roots.unmetNeeds && roots.needs.length === 0 && dash}
        </RootItem>
        <RootItem title="Схемы">
          {roots.schemas.length === 0 ? (
            dash
          ) : (
            <div style={chipRowStyle}>
              {roots.schemas.map((s) => (
                <span key={s.id} style={miniChipStyle}>
                  <IdentityDot color={s.color} size={6} /> {s.name}
                </span>
              ))}
            </div>
          )}
        </RootItem>
      </div>
    </section>
  );
}
