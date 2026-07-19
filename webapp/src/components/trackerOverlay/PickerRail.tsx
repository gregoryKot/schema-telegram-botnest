export function PickerRail({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(11, 1fr)',
          gap: 4,
        }}
      >
        {Array.from({ length: 11 }, (_, i) => {
          const active = i === value;
          const passed = value > 0 && i < value;
          return (
            <button
              key={i}
              onClick={() => onChange(i)}
              style={{
                aspectRatio: '1 / 1.2',
                border: 'none',
                borderRadius: 8,
                padding: 0,
                background: active
                  ? color
                  : passed
                    ? `color-mix(in srgb, ${color} 12%, transparent)`
                    : 'transparent',
                boxShadow: active
                  ? 'none'
                  : `inset 0 0 0 1px rgba(var(--fg-rgb),0.12)`,
                color: active
                  ? 'var(--bg)'
                  : passed
                    ? color
                    : 'var(--text-sub)',
                fontFamily: 'var(--serif)',
                fontSize: active ? 26 : 20,
                fontWeight: 400,
                fontStyle: active ? 'italic' : 'normal',
                letterSpacing: '-0.02em',
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
            >
              {i}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          fontSize: 11,
          color: 'var(--text-faint)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        <span>низко</span>
        <span>средне</span>
        <span>хорошо</span>
      </div>
      {value === 0 && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 14,
            fontSize: 11,
            color: 'var(--text-ghost)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          ни одна цифра не выбрана
        </div>
      )}
    </div>
  );
}
