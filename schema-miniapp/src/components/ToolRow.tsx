// iOS-строка по дизайн-макету: плашка-иконка, заголовок с подписью, шеврон.
// Каскадное появление (index → задержка); глушится reduced-motion блоком CSS.
export function ToolRow({
  emoji,
  label,
  sub,
  onClick,
  tint = 'var(--accent)',
  danger,
  index = 0,
}: {
  emoji: string;
  label: string;
  sub?: string;
  onClick: () => void;
  tint?: string;
  danger?: boolean;
  index?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: '13px 16px',
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        minHeight: 66,
        animation: 'slide-up 0.3s ease both',
        animationDelay: `${index * 45}ms`,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flexShrink: 0,
          background: `color-mix(in srgb, ${tint} 14%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 19,
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: danger ? 'var(--accent-red)' : 'var(--text)',
            lineHeight: 1.3,
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-sub)',
              marginTop: 1,
              lineHeight: 1.4,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <span style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}>
        ›
      </span>
    </button>
  );
}
