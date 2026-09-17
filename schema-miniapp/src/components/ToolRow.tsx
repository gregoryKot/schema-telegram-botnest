/**
 * Строка-переход: название, подпись, шеврон. Без иконки-плашки — различие
 * несут название и подпись, как в хабе дневников. Цветная плашка с эмодзи
 * давала двенадцать разных пятен в одном списке: глаз цеплялся за цвет,
 * а не за смысл, и строки читались дольше, чем без неё.
 *
 * Каскадное появление (index → задержка); глушится reduced-motion блоком CSS.
 */
export function ToolRow({
  label,
  sub,
  onClick,
  danger,
  index = 0,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
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
        padding: '15px 16px',
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-12)',
        minHeight: 66,
        animation: 'slide-up 0.3s ease both',
        animationDelay: `${index * 45}ms`,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: danger ? 'var(--accent-red)' : 'var(--text)',
            lineHeight: 1.35,
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--muted)',
              marginTop: 3,
              lineHeight: 1.45,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <span style={{ color: 'var(--chevron)', fontSize: 19, flexShrink: 0 }}>
        ›
      </span>
    </button>
  );
}
