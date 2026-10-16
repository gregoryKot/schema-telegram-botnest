import { hueStyle } from '../../../lib/tone';
import { HUE_STRAIN, HUE_CARE } from '../exHue';

// Экран «готово»: было → стало, рядом дословно. Вёрстка — по образцу
// ink-карточки BeliefDoneScreen (единый визуальный язык done-экранов упражнений
// webapp), только с двумя цитатами вместо таблицы доказательств.
export function PhraseDoneCard({
  phrase,
  rewrite,
}: {
  phrase: string;
  rewrite: string;
}) {
  const trimmedRewrite = rewrite.trim();
  return (
    <div className="ds-card ds-card--ink ex2-done">
      <div className="ex2-dlabel is-tone" style={hueStyle(HUE_STRAIN)}>
        Было
      </div>
      <div className="ex2-quote ex2-quote--em">«{phrase}»</div>
      {trimmedRewrite && (
        <div style={hueStyle(HUE_CARE)}>
          <div className="ex2-dlabel is-tone">Стало</div>
          <div className="ex2-quote is-tone">«{trimmedRewrite}»</div>
        </div>
      )}
    </div>
  );
}
