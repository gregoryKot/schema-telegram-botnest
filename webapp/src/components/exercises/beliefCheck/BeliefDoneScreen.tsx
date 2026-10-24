import { ExScreen, GlyphCheck } from '../ExScreen';
import { fmtAgo } from '../../../utils/format';
import type { api } from '../../../api';
import { hueStyle } from '../../../lib/tone';
import { HUE_STRAIN, HUE_CARE } from '../exHue';

type BeliefCheckRow = Awaited<ReturnType<typeof api.getBeliefChecks>>[number];

// Экран «сохранено» проверки убеждения: карточка результата, прошлые
// проверки в боковой колонке, кнопки «ещё одна»/«закрыть».
// Вынесено из BeliefCheckEx.tsx (правило №10).
export function BeliefDoneScreen({
  goBack,
  belief,
  forList,
  againstList,
  reframe,
  history,
  pastChecks,
  onRestart,
}: {
  goBack: () => void;
  belief: string;
  forList: string[];
  againstList: string[];
  reframe: string;
  history: BeliefCheckRow[];
  pastChecks: BeliefCheckRow[];
  onRestart: () => void;
}) {
  return (
  <ExScreen
    onBack={goBack}
    eyebrow="Проверка убеждения · сохранено"
    title={
      <>
        Готово.
        <br />
        <span className="it">Мысль проверена.</span>
      </>
    }
    lede="Иногда достаточно увидеть доказательства, чтобы мысль потеряла силу. Сохранено в дневнике."
    aside={
      <>
        <div className="ds-card ex2-note">
          <div className="ds-label">Что попробовать дальше</div>
          <h3 className="ex2-note-h">Знакомство со схемой</h3>
          <p className="ex2-note-body">
            Если эта мысль возвращается часто – стоит копнуть, какая схема
            за ней стоит.
          </p>
        </div>
        {pastChecks.length > 0 && (
          <div className="ds-card ex2-note">
            <div className="ds-label">
              Прошлые проверки · {history.length}
            </div>
            {pastChecks.map((h, i) => (
              <div key={i} className="ex2-hist-row">
                <span className="ex2-hist-date">{fmtAgo(h.createdAt)}</span>
                <span className="ex2-hist-snip">«{h.belief}»</span>
              </div>
            ))}
          </div>
        )}
      </>
    }
  >
    <div className="ds-card ds-card--ink ex2-done">
      <div className="ex2-stamp">
        <GlyphCheck /> Сохранено ·{' '}
        {new Date().toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
        })}
      </div>
      <div className="ex2-dlabel">Убеждение</div>
      <div className="ex2-quote ex2-quote--em">«{belief}»</div>
      <div className="ex2-cols">
        <div style={hueStyle(HUE_STRAIN)}>
          <div className="ex2-dlabel is-tone">За · {forList.length}</div>
          <ul className="ex2-ev">
            {forList.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
        <div style={hueStyle(HUE_CARE)}>
          <div className="ex2-dlabel is-tone">Против · {againstList.length}</div>
          <ul className="ex2-ev">
            {againstList.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
      {reframe.trim() && (
        <>
          <div className="ex2-dlabel">Точнее</div>
          <div className="ex2-quote">«{reframe}»</div>
        </>
      )}
    </div>
    <div className="ex2-foot">
      <button className="ds-btn ds-btn--secondary" onClick={onRestart}>
        Проверить ещё одну
      </button>
      <span className="ex2-spacer" />
      <button className="ds-btn" onClick={goBack}>
        Закрыть
      </button>
    </div>
  </ExScreen>
  );
}
