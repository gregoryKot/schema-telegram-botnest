import { ExScreen, GlyphArrowRight } from '../ExScreen';
import { useTr } from '../../../utils/addressForm';
import { hueStyle, NEED_HUE } from '../../../lib/tone';
import { NEEDS } from './needs';
import { CWTrack } from './CWTrack';
import { WheelSvg } from './WheelSvg';
import { NeedExamples } from './NeedExamples';
import type { NeedId } from '../../../../../shared/src/needs/types';
import { previewRatings, unratedHint } from '../../../../../shared/src/childhoodWheel/useChildhoodDraft';

/** Ввод оценок: пять ползунков с примерами, предпросмотр колеса, сохранение. Неоценённая потребность — «—», сохранить можно, когда выставлены все. */
export function ChildhoodFill({
  title,
  ratings,
  unrated,
  onChange,
  onBack,
  onCancel,
  onSave,
  saving,
  error,
}: {
  title: React.ReactNode;
  ratings: Record<NeedId, number>;
  unrated: NeedId[];
  onChange: (id: NeedId, v: number) => void;
  onBack: () => void;
  /** Есть сохранённый результат, к которому можно вернуться без сохранения. */
  onCancel?: () => void;
  onSave: () => void;
  saving: boolean;
  error: boolean;
}) {
  const tr = useTr();
  const val = (id: NeedId) => (unrated.includes(id) ? undefined : ratings[id]);
  return (
    <ExScreen
      onBack={onBack}
      eyebrow="№ 06 · Истоки"
      title={title}
      lede="Оцени пять базовых потребностей в детстве. Не отдельные моменты, а как было «в целом, большую часть времени» – там, где формировались схемы."
      aside={
        <>
          <div className="ds-card ds-card--warn ex2-note">
            <div className="ds-label">Внимание</div>
            <h3 className="ex2-note-h">Защитная идеализация</h3>
            <p className="ex2-note-body">
              Психика прячет систематические паттерны и подсвечивает редкие хорошие моменты.
              Оценивай не «как могло быть», а «как было обычно, в большинстве лет».
            </p>
          </div>
          <div className="ds-card ex2-note">
            <div className="ds-label">Предпросмотр</div>
            <WheelSvg ratings={previewRatings(ratings, unrated)} />
            <div className="ex2-cw-legend">
              {NEEDS.map((n) => (
                <div key={n.id} className="ex2-cw-legend-row" style={hueStyle(NEED_HUE[n.id])}>
                  <span className="ds-dot tone-fill" />
                  {n.label}
                  <span className={'ex2-cw-legend-val' + zone(val(n.id))}>{val(n.id) ?? '—'}</span>
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
            <CWTrack value={val(n.id)} onChange={(v) => onChange(n.id, v)} hue={NEED_HUE[n.id]} />
            <div className="ex2-cw-ends">
              <div className={'ex2-cw-end' + ((val(n.id) ?? 5) <= 4 ? ' is-low' : '')}>
                <b>0 – дефицит. </b>
                {n.low}
              </div>
              <div className={'ex2-cw-end' + ((val(n.id) ?? 5) >= 8 ? ' is-high' : '')}>
                <b>10 – насыщение. </b>
                {n.high}
              </div>
            </div>
            <NeedExamples needId={n.id} />
          </div>
          <div className={'ex2-cw-value' + (val(n.id) === undefined ? ' is-unset' : '')}>
            {val(n.id) ?? '—'}
            <span>{val(n.id) === undefined ? ' не оценено' : '/10'}</span>
          </div>
        </div>
      ))}
      {error && (
        <div role="alert" className="ex2-err ex2-gap">
          {tr(
            'Не удалось сохранить. Проверь связь и попробуй ещё раз',
            'Не удалось сохранить. Проверьте связь и попробуйте ещё раз',
          )}
        </div>
      )}
      <div className="ex2-foot">
        {onCancel && (
          <button type="button" className="ds-btn ds-btn--secondary" disabled={saving} onClick={onCancel}>
            Отмена
          </button>
        )}
        <span className="ex2-spacer" />
        {unrated.length > 0 && <span className="ex2-cw-left" role="status">{unratedHint(unrated.length)}</span>}
        <button type="button" className="ds-btn" disabled={saving || unrated.length > 0} onClick={onSave}>
          {saving ? 'Сохраняю…' : <>Посмотреть результат <GlyphArrowRight /></>}
        </button>
      </div>
    </ExScreen>
  );
}

const zone = (v: number | undefined) => (v === undefined ? '' : v <= 4 ? ' is-low' : v <= 6 ? ' is-mid' : '');
