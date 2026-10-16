import { useState } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphArrowRight } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useSavingAction } from '../../hooks/useSavingAction';
import { useTr } from '../../utils/addressForm';
import { hueStyle, NEED_HUE } from '../../lib/tone';
import { NEEDS } from './childhoodWheel/needs';
import { CWTrack } from './childhoodWheel/CWTrack';
import { WheelSvg } from './childhoodWheel/WheelSvg';

export function ChildhoodWheelEx({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved?: (r: Record<string, number>) => void;
}) {
  const goBack = useHistorySheet(onBack);
  const tr = useTr();
  const [ratings, setRatings] = useState<Record<string, number>>({
    attachment: 5,
    autonomy: 5,
    expression: 5,
    play: 5,
    limits: 5,
  });
  const [done, setDone] = useState(false);

  function set(id: string, v: number) {
    setRatings((r) => ({ ...r, [id]: v }));
  }
  const avg =
    Math.round(
      (Object.values(ratings).reduce((a, b) => a + b, 0) / NEEDS.length) * 10,
    ) / 10;
  const lowNeeds = NEEDS.filter((n) => ratings[n.id] <= 4);

  // Та же беда, что нашли в FlashcardEx (аудит 2026-08-22, находка №2):
  // сбой saveChildhoodRatings молча игнорировался, а колесо всё равно
  // показывало результат как сохранённый, и не было ни индикации отправки,
  // ни защиты от двойного нажатия. useSavingAction — общий примитив.
  const { saving, error, run } = useSavingAction();
  async function save() {
    const ok = await run(() => api.saveChildhoodRatings(ratings));
    if (ok) { onSaved?.(ratings); setDone(true); }
  }

  if (done) {
    return (
      <ExScreen
        onBack={goBack}
        eyebrow="Колесо детства · сохранено"
        title={
          <>
            Колесо
            <br />
            <span className="it">детства</span>
          </>
        }
        lede={`Среднее ${avg}/10. ${lowNeeds.length ? `${lowNeeds.length} зон ниже 5 – это места, где могли сформироваться схемы.` : 'Все зоны выше 4 – это редкий ресурс.'}`}
        aside={
          <div className="ds-card ex2-note">
            <div className="ds-label">Что дальше</div>
            <h3 className="ex2-note-h">Связать с сегодня</h3>
            <p className="ex2-note-body">
              {tr(
                'Открой дневник за последнюю неделю и сравни – какие потребности сегодня просели больше всего. Часто это те же зоны.',
                'Откройте дневник за последнюю неделю и сравните – какие потребности сегодня просели больше всего. Часто это те же зоны.',
              )}
            </p>
          </div>
        }
      >
        <div className="ex2-cw-grid">
          <div>
            {NEEDS.map((n, i) => (
              <div key={n.id} className="ex2-cw-row" style={hueStyle(NEED_HUE[n.id])}>
                <span className="ex2-cw-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="ex2-cw-label">{n.label}</div>
                  <div className="ex2-cw-q">
                    {ratings[n.id] <= 4
                      ? n.low
                      : ratings[n.id] >= 8
                        ? n.high
                        : 'Где-то между. Бывало по-разному.'}
                  </div>
                </div>
                <div className="ex2-cw-value">
                  {ratings[n.id]}
                  <span>/10</span>
                </div>
              </div>
            ))}
          </div>
          <div className="ds-card ex2-note">
            <h3 className="ex2-note-h">{tr('Твоё колесо', 'Ваше колесо')}</h3>
            <div className="ds-sub ex2-count">
              Сохранено ·{' '}
              {new Date().toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
              })}
            </div>
            <WheelSvg ratings={ratings} />
          </div>
        </div>
        <div className="ex2-foot">
          <button className="ds-btn ds-btn--secondary" onClick={() => setDone(false)}>
            Пересмотреть оценки
          </button>
          <span className="ex2-spacer" />
          <button className="ds-btn" onClick={goBack}>
            Закрыть
          </button>
        </div>
      </ExScreen>
    );
  }

  return (
    <ExScreen
      onBack={goBack}
      eyebrow="№ 06 · Истоки"
      title={
        <>
          Колесо
          <br />
          <span className="it">детства</span>
        </>
      }
      lede="Оцени пять базовых потребностей в детстве. Не отдельные моменты, а как было «в целом, большую часть времени» – там, где формировались схемы."
      aside={
        <>
          <div className="ds-card ds-card--warn ex2-note">
            <div className="ds-label">Внимание</div>
            <h3 className="ex2-note-h">Защитная идеализация</h3>
            <p className="ex2-note-body">
              Психика прячет систематические паттерны и подсвечивает редкие
              хорошие моменты. Оценивай не «как могло быть», а «как было обычно,
              в большинстве лет».
            </p>
          </div>
          <div className="ds-card ex2-note">
            <div className="ds-label">Предпросмотр</div>
            <WheelSvg ratings={ratings} />
            <div className="ex2-cw-legend">
              {NEEDS.map((n) => (
                <div key={n.id} className="ex2-cw-legend-row" style={hueStyle(NEED_HUE[n.id])}>
                  <span className="ds-dot tone-fill" />
                  {n.label}
                  <span
                    className={
                      'ex2-cw-legend-val' +
                      (ratings[n.id] <= 4 ? ' is-low' : ratings[n.id] <= 6 ? ' is-mid' : '')
                    }
                  >
                    {ratings[n.id]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      }
    >
      <div className="ex2-cw-scale">
        <span>0 – почти не было</span>
        <span>5 – где-то посередине</span>
        <span>10 – в полной мере</span>
      </div>
      {NEEDS.map((n, i) => (
        <div key={n.id} className="ex2-cw-row" style={hueStyle(NEED_HUE[n.id])}>
          <span className="ex2-cw-num">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <div className="ex2-cw-label">{n.label}</div>
            <div className="ex2-cw-q">{n.question}</div>
            <CWTrack value={ratings[n.id]} onChange={(v) => set(n.id, v)} hue={NEED_HUE[n.id]} />
            <div className="ex2-cw-ends">
              <div className={'ex2-cw-end' + (ratings[n.id] <= 4 ? ' is-low' : '')}>
                <b>0 – дефицит. </b>
                {n.low}
              </div>
              <div className={'ex2-cw-end' + (ratings[n.id] >= 8 ? ' is-high' : '')}>
                <b>10 – насыщение. </b>
                {n.high}
              </div>
            </div>
          </div>
          <div className="ex2-cw-value">
            {ratings[n.id]}
            <span>/10</span>
          </div>
        </div>
      ))}
      {error && (
        <div role="alert" className="ex2-err ex2-gap">
          {tr('Не удалось сохранить. Проверь связь и попробуй ещё раз', 'Не удалось сохранить. Проверьте связь и попробуйте ещё раз')}
        </div>
      )}
      <div className="ex2-foot">
        <span className="ex2-spacer" />
        <button className="ds-btn" disabled={saving} onClick={save}>
          {saving ? 'Сохраняю…' : <>Посмотреть результат <GlyphArrowRight /></>}
        </button>
      </div>
    </ExScreen>
  );
}
