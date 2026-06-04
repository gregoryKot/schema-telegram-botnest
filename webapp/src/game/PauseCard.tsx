import type { Obstacle } from './obstacles';

interface Props {
  obstacle: Obstacle;
  onContinue: () => void;
  understood: number;
  total: number;
}

const WORLD_LABELS = { 1: 'До звонка', 2: 'Первые сессии', 3: 'Между сессиями' } as const;

export function PauseCard({ obstacle, onContinue, understood, total }: Props) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(15,12,8,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', zIndex: 10,
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: '#f5f2eb',
        borderRadius: 20,
        maxWidth: 480, width: '100%',
        padding: '28px 28px 24px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* World label */}
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          color: 'rgba(28,25,20,0.45)', textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          Мир {obstacle.world} · {WORLD_LABELS[obstacle.world]}
          {obstacle.isBoss && <span style={{ color: '#7c3aed', marginLeft: 6 }}>⚔ БОСС</span>}
        </div>

        {/* Enemy + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: obstacle.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, flexShrink: 0,
            boxShadow: obstacle.isBoss ? `0 0 20px ${obstacle.color}66` : 'none',
          }}>
            {obstacle.emoji}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1c1916', lineHeight: 1.2 }}>
              {obstacle.name}
            </div>
            <div style={{
              display: 'inline-block', marginTop: 4, padding: '3px 10px',
              borderRadius: 20, background: 'rgba(77,71,153,0.1)',
              fontSize: 11, color: '#4d4799', fontWeight: 600,
            }}>
              {obstacle.schema}
            </div>
          </div>
        </div>

        {/* Quote */}
        <div style={{
          borderLeft: `3px solid ${obstacle.color}`,
          paddingLeft: 14, marginBottom: 20,
          fontStyle: 'italic', fontSize: 15,
          color: 'rgba(28,25,20,0.75)', lineHeight: 1.6,
        }}>
          {obstacle.quote}
        </div>

        {/* What */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'rgba(28,25,20,0.4)',
            marginBottom: 6,
          }}>
            Что это такое
          </div>
          <div style={{ fontSize: 14, color: '#1c1916', lineHeight: 1.7 }}>
            {obstacle.what}
          </div>
        </div>

        {/* Tip */}
        <div style={{
          background: 'rgba(77,71,153,0.07)',
          borderRadius: 12, padding: '14px 16px',
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#4d4799',
            marginBottom: 6,
          }}>
            Что помогает
          </div>
          <div style={{ fontSize: 14, color: '#1c1916', lineHeight: 1.7 }}>
            {obstacle.tip}
          </div>
        </div>

        {/* Progress */}
        <div style={{ fontSize: 12, color: 'rgba(28,25,20,0.4)', marginBottom: 16, textAlign: 'center' }}>
          Понято схем: {understood} / {total}
        </div>

        {/* Button */}
        <button
          onClick={onContinue}
          style={{
            width: '100%', padding: '14px',
            background: '#4d4799', color: '#fff',
            border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          Понял — продолжить →
        </button>
      </div>
    </div>
  );
}
