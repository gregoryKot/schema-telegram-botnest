import { DOW_SHORT, TODAY_DOW_IDX } from './streakConst';
import { daysWord } from './profileModel';
import type { StreakData } from './profileMeta';

interface Props { streak: StreakData; onOpenTracker?: () => void }

export function StreakCard({ streak, onOpenTracker }: Props) {
  const { currentStreak, longestStreak, totalDays, todayDone, weekDots } = streak;
  const caption = currentStreak > 0
    ? `${daysWord(currentStreak)}\nподряд`
    : totalDays === 0 ? 'пока\nне начато' : 'серия\nпрервалась';
  return (
    <section className="ds-card cpf-card cpf-streak-card">
      <h2 className="ds-h3 cpf-streak-title">Стрик</h2>
      <div className="cpf-streak-top">
        <div className="cpf-streak-main">
          <div className={`ds-num cpf-streak-num${currentStreak === 0 ? ' is-zero' : todayDone ? ' is-done' : ''}`}>
            {currentStreak > 0 ? currentStreak : '–'}
          </div>
          <div className="cpf-streak-cap">{caption}</div>
        </div>
        <div className="cpf-streak-side">
          {longestStreak > 0 && (
            <div><div className="cpf-streak-val">{longestStreak}</div><div className="ds-label">рекорд</div></div>
          )}
          <div><div className="cpf-streak-val">{totalDays}</div><div className="ds-label">всего</div></div>
        </div>
      </div>
      {weekDots.length > 0 && (
        <div className="cpf-week">
          {weekDots.map((done, i) => (
            <div key={i} className="cpf-week-day">
              <div className={`cpf-week-bar${done ? ' is-done' : ''}${i === TODAY_DOW_IDX ? ' is-today' : ''}`} />
              <div className={`cpf-week-name${i === TODAY_DOW_IDX ? ' is-today' : ''}`}>{DOW_SHORT[i]}</div>
            </div>
          ))}
        </div>
      )}
      {currentStreak === 0 && totalDays > 0 && onOpenTracker && (
        <button type="button" className="ds-btn ds-btn--secondary cpf-cta" onClick={onOpenTracker}>Заполнить сегодня →</button>
      )}
    </section>
  );
}
