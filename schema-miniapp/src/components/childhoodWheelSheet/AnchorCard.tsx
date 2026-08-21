export function AnchorCard({
  active,
  color,
  title,
  text,
}: {
  active: boolean;
  color: string;
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        lineHeight: 1.55,
        padding: '7px 9px',
        borderRadius: 10,
        background: active
          ? `color-mix(in srgb, ${color} 10%, transparent)`
          : 'rgba(var(--fg-rgb),0.03)',
        color: active
          ? `color-mix(in srgb, ${color} 75%, transparent)`
          : 'rgba(var(--fg-rgb),0.25)',
        border: active
          ? `1px solid color-mix(in srgb, ${color} 20%, transparent)`
          : '1px solid transparent',
        transition: 'all 0.2s',
      }}
    >
      <span
        style={{
          fontWeight: 600,
          display: 'block',
          marginBottom: 2,
        }}
      >
        {title}
      </span>
      {text}
    </div>
  );
}
