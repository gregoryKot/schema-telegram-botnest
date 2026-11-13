import { hitboxStyle } from '../../utils/hitbox';
import { SignArt } from '../../components/art/SignArt';
import { needDataStyle } from '../../components/needDataColor';
import { BLOCK_META } from '../../../../shared/src/screens/screenBlocks';
import { NEED_NAMES } from './profileMeta';
import type { InsightsData } from './profileMeta';
import { trendKind, TREND_SYMBOL, patternBarPercent } from './profileModel';

const TREND_TEXT = { up: 'растёт', down: 'снижается', flat: 'держится ровно' };

interface Props { insights: InsightsData; onBestDayInfo: () => void }

// Две плашки бумаги (лучший день — шалфей, тяжелее — роза) и строки «потребность — среднее ↑» с полосой
// цветом данных потребности (needDataStyle, палитра данных); знак блока — BLOCK_META.insights.
export function PatternsCard({ insights, onBestDayInfo }: Props) {
  const showDays = (insights.bestDayOfWeek || insights.worstDayOfWeek) && insights.totalDays >= 7;
  return (
    <section className="cpf-sec">
      <span className="cpf-title">
        <span className="pp-row-art" aria-hidden="true"><SignArt sign={BLOCK_META.insights?.sign ?? 'layers'} size="row" /></span>
        <h2 className="ds-h3">Паттерны</h2>
      </span>
      {showDays && (
        <div className="cpf-pills">
          {insights.bestDayOfWeek && (
            <div className="pp-paper cpf-pill is-best">
              <div>
                <div className="cpf-pill-key">лучший день</div>
                <b className="cpf-pill-val">{insights.bestDayOfWeek}</b>
              </div>
              <button type="button" aria-label="Что такое лучший день" className="cpf-help"
                onClick={e => { e.stopPropagation(); onBestDayInfo(); }} style={hitboxStyle(18, 18, 44).outer}>
                <span style={hitboxStyle(18, 18, 44).inner} className="cpf-help-dot">?</span>
              </button>
            </div>
          )}
          {insights.worstDayOfWeek && (
            <div className="pp-paper cpf-pill is-worst">
              <div>
                <div className="cpf-pill-key">тяжелее</div>
                <b className="cpf-pill-val">{insights.worstDayOfWeek}</b>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="cpf-progs">
        {insights.weeklyStats.filter(s => s.avg !== null).map(s => {
          const k = trendKind(s.trend);
          return (
            <div key={s.needId} className="cpf-prog" style={needDataStyle(s.needId)}>
              <div className="cpf-prog-head">
                <span className="cpf-prog-name">{NEED_NAMES[s.needId]}</span>
                <span className={`cpf-prog-val is-${k}`}>
                  <b>{(s.avg ?? 0).toFixed(1)}</b>
                  <span aria-hidden="true"> {TREND_SYMBOL[k]}</span>
                  <span className="cpf-vh">, в среднем за неделю, {TREND_TEXT[k]}</span>
                </span>
              </div>
              <div className="cpf-prog-track" aria-hidden="true">
                <div className={`cpf-prog-fill is-${k}`} style={{ width: `${patternBarPercent(s.avg)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
