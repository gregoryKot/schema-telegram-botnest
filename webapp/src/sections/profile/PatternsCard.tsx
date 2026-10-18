import { hitboxStyle } from '../../utils/hitbox';
import { NEED_NAMES } from './profileMeta';
import type { InsightsData } from './profileMeta';
import { trendKind, TREND_SYMBOL } from './profileModel';

const TREND_TEXT = { up: 'растёт', down: 'снижается', flat: 'держится ровно' };

interface Props { insights: InsightsData; onBestDayInfo: () => void }

export function PatternsCard({ insights, onBestDayInfo }: Props) {
  const showDays = (insights.bestDayOfWeek || insights.worstDayOfWeek) && insights.totalDays >= 7;
  return (
    <section className="ds-card cpf-card">
      <h2 className="ds-h3">Паттерны</h2>
      {insights.weeklyStats.filter(s => s.avg !== null).map(s => {
        const k = trendKind(s.trend);
        return (
          <div key={s.needId} className="cpf-pattern">
            <span className={`ds-num cpf-pattern-sym is-${k}`}>{TREND_SYMBOL[k]}</span>
            <div className="cpf-pattern-text">
              {NEED_NAMES[s.needId]} — в среднем <b>{(s.avg ?? 0).toFixed(1)}</b>, {TREND_TEXT[k]}
            </div>
          </div>
        );
      })}
      {showDays && insights.bestDayOfWeek && (
        <div className="cpf-pattern">
          <span className="ds-num cpf-pattern-sym is-up">↑</span>
          <div className="cpf-pattern-text">
            <span className="cpf-pattern-key">лучший день</span> <b>{insights.bestDayOfWeek}</b>
            <button type="button" aria-label="Что такое лучший день" className="cpf-help"
              onClick={e => { e.stopPropagation(); onBestDayInfo(); }} style={hitboxStyle(18, 18, 44).outer}>
              <span style={hitboxStyle(18, 18, 44).inner} className="cpf-help-dot">?</span>
            </button>
          </div>
        </div>
      )}
      {showDays && insights.worstDayOfWeek && (
        <div className="cpf-pattern">
          <span className="ds-num cpf-pattern-sym is-down">↓</span>
          <div className="cpf-pattern-text"><span className="cpf-pattern-key">тяжелее</span> <b>{insights.worstDayOfWeek}</b></div>
        </div>
      )}
    </section>
  );
}
