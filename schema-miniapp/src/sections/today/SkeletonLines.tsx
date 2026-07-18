// SkeletonLines — shimmer placeholder for the diary card (extracted from TodaySection.tsx).

export function SkeletonLines() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[80, 65, 90].map((w, i) => (
        <div
          key={i}
          style={{
            height: 12,
            borderRadius: 6,
            width: `${w}%`,
            background:
              'linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)',
            backgroundSize: '200% auto',
            animation: 'shimmer 1.5s linear infinite',
          }}
        />
      ))}
    </div>
  );
}
