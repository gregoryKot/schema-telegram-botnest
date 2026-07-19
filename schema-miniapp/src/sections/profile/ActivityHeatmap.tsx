interface ActivityHeatmapProps {
  activeDates: Set<string>;
}

export function ActivityHeatmap({ activeDates }: ActivityHeatmapProps) {
  // P7 UI-аудит: короче и крупнее — влезает без скрытого скролла
  const WEEKS = 10;
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - todayDow - (WEEKS - 1) * 7);

  const weeks: { date: Date; dateStr: string }[][] = [];
  const cur = new Date(startDate);
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: Date; dateStr: string }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cur.toISOString().slice(0, 10);
      week.push({ date: new Date(cur), dateStr });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const MONTH_RU = [
    'янв',
    'фев',
    'мар',
    'апр',
    'май',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];

  return (
    <div
      className="card"
      style={{ borderRadius: 20, padding: '16px 16px 14px' }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 12,
        }}
      >
        Активность
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              paddingTop: 16,
            }}
          >
            {['пн', '', 'ср', '', 'пт', '', 'вс'].map((d, i) => (
              <div
                key={i}
                style={{
                  height: 13,
                  fontSize: 8,
                  color: 'var(--text-faint)',
                  lineHeight: '13px',
                  width: 14,
                  textAlign: 'right',
                  paddingRight: 3,
                }}
              >
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => {
            const firstOfMonth = week.find(
              (c) => c.date.getDate() <= 7 && c.date.getDay() === 1,
            );
            const monthLabel = firstOfMonth
              ? MONTH_RU[firstOfMonth.date.getMonth()]
              : '';
            return (
              <div
                key={wi}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div
                  style={{
                    height: 13,
                    fontSize: 8,
                    color: 'var(--text-faint)',
                    lineHeight: '13px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {monthLabel}
                </div>
                {week.map(({ dateStr, date }) => {
                  const isActive = activeDates.has(dateStr);
                  const isFuture = date > today;
                  return (
                    <div
                      key={dateStr}
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: 3,
                        background: isFuture
                          ? 'transparent'
                          : isActive
                            ? 'var(--accent)'
                            : 'rgba(var(--fg-rgb),0.07)',
                        opacity: isFuture ? 0 : 1,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 5,
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>меньше</span>
        {[0, 0.35, 0.65, 1].map((o, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background:
                i === 0
                  ? 'rgba(var(--fg-rgb),0.07)'
                  : `color-mix(in srgb, var(--accent) ${Math.round(o * 100)}%, transparent)`,
            }}
          />
        ))}
        <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>больше</span>
      </div>
    </div>
  );
}
