import { STEPS } from './data';

export function ProgressBar({ stepIndex }: { stepIndex: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
      {STEPS.map((s, i) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background:
              i < stepIndex
                ? 'var(--accent)'
                : i === stepIndex
                  ? 'rgba(var(--fg-rgb),0.25)'
                  : 'var(--surface-2)',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
}
