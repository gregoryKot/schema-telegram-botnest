import { ExScreen, GlyphCheck } from '../ExScreen';
import { fmtAgo } from '../../../utils/format';
import type { api } from '../../../api';

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
    eyebrowColor="var(--c-moss)"
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
        <div className="aside-card">
          <div className="aside-card-eyebrow">Что попробовать дальше</div>
          <h3>Знакомство со схемой</h3>
          <p className="body">
            Если эта мысль возвращается часто – стоит копнуть, какая схема
            за ней стоит.
          </p>
        </div>
        {pastChecks.length > 0 && (
          <div className="aside-card">
            <div className="aside-card-eyebrow">
              Прошлые проверки · {history.length}
            </div>
            {pastChecks.map((h, i) => (
              <div key={i} className="history-row">
                <span className="history-date">{fmtAgo(h.createdAt)}</span>
                <span className="history-snippet">«{h.belief}»</span>
              </div>
            ))}
          </div>
        )}
      </>
    }
  >
    <div className="done-card">
      <div className="stamp">
        <GlyphCheck /> Сохранено ·{' '}
        {new Date().toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
        })}
      </div>
      <div className="dlabel">Убеждение</div>
      <div className="belief-line">«{belief}»</div>
      <div className="done-cols">
        <div>
          <div className="dlabel" style={{ color: 'var(--c-rose)' }}>
            За · {forList.length}
          </div>
          <ul className="ev-col" style={{ margin: 0, padding: 0 }}>
            {forList.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="dlabel" style={{ color: 'var(--c-moss)' }}>
            Против · {againstList.length}
          </div>
          <ul className="ev-col" style={{ margin: 0, padding: 0 }}>
            {againstList.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
      {reframe.trim() && (
        <>
          <div className="dlabel" style={{ color: 'var(--accent)' }}>
            Точнее
          </div>
          <div className="reframe-line">«{reframe}»</div>
        </>
      )}
    </div>
    <div className="ex-foot">
      <button
        className="ex-btn ex-btn-outline"
        onClick={onRestart}
      >
        Проверить ещё одну
      </button>
      <span className="spacer" />
      <button className="ex-btn ex-btn-primary" onClick={goBack}>
        Закрыть
      </button>
    </div>
  </ExScreen>
  );
}
