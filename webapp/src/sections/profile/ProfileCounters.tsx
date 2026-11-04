import { counterItems } from './profileModel';

interface Props { streak: number; totalDays: number; diaryCount: number; ysqCount: number }

export function ProfileCounters(props: Props) {
  return (
    <section className="cpf-progress">
      <div className="ds-label cpf-label">Прогресс</div>
      <div className="cpf-counters">
        {counterItems(props).map(([n, l], i) => (
          <div key={i} className={`cpf-counter ds-card${i === 0 ? ' ds-card--ink' : ''}`}>
            <div className="ds-num cpf-counter-num">{n}</div>
            <div className="cpf-counter-label">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
