interface Props { streak: number; totalDays: number; diaryCount: number; ysqCount: number }

export function ProfileCounters({ streak, totalDays, diaryCount, ysqCount }: Props) {
  const items: [number, string][] = [
    [streak, 'дней стрика'],
    [totalDays, 'дней всего'],
    [diaryCount, 'записей дневника'],
    [ysqCount, 'прохождений теста'],
  ];
  return (
    <section>
      <div className="ds-label cpf-label">Прогресс</div>
      <div className="cpf-counters">
        {items.map(([n, l], i) => (
          <div key={l} className={`cpf-counter ds-card${i === 0 ? ' ds-card--ink' : ''}`}>
            <div className="ds-num cpf-counter-num">{n}</div>
            <div className="cpf-counter-label">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
