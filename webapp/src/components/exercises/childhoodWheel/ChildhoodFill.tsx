import { ExScreen, GlyphArrowRight } from '../ExScreen';
import { useTr } from '../../../utils/addressForm';
import { PaperAlert } from '../../paper/PaperAlert';
import { NEEDS } from './needs';
import { NeedRateRow } from './NeedRateRow';
import { WheelScene } from './WheelScene';
import type { NeedId } from '../../../../../shared/src/needs/types';
import { unratedHint } from '../../../../../shared/src/childhoodWheel/useChildhoodDraft';
import { exerciseCard } from '../../../../../shared/src/exercises/exerciseCatalog';

/**
 * Ввод оценок: пять строк с ползунками и примерами, сохранение. Неоценённая потребность — «—», сохранить
 * можно, когда выставлены все. Колесо (SceneChildhood values) растёт по мере ответов: на компьютере — сцена
 * листа-героя в липкой колонке разворота, на телефоне и планшете — мини-сцена в липкой полосе со шкалой над
 * строками (одна сцена на экран: вторую прячет sheet-childhood.css по ширине). «Защитная идеализация» —
 * наклейка соломы под листом, до первой строки.
 */
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
  onSave: () => void; saving: boolean; error: boolean;
}) {
  const tr = useTr();
  const scene = (cls: string) => <WheelScene ratings={ratings} unrated={unrated} className={cls} />;
  return (
    <ExScreen
      onBack={onBack} spread compact look="childhood_wheel" heroArt={scene('chw-scene--side')}
      eyebrow={exerciseCard('wheel').eyebrow}
      title={title}
      lede={tr(
        'Оцени пять базовых потребностей в детстве. Не отдельные моменты, а как было «в целом, большую часть времени» – там, где формировались схемы.',
        'Оцените пять базовых потребностей в детстве. Не отдельные моменты, а как было «в целом, большую часть времени» – там, где формировались схемы.',
      )}
      aside={
        <div className="pp-paper chw-idealize">
          <div className="ds-label">Внимание</div>
          <h3 className="chw-idealize-h">Защитная идеализация</h3>
          <p className="chw-idealize-body">
            Психика прячет систематические паттерны и подсвечивает редкие хорошие моменты.{' '}
            {tr('Оценивай не «как могло быть», а «как было обычно, в большинстве лет».', 'Оценивайте не «как могло быть», а «как было обычно, в большинстве лет».')}
          </p>
        </div>
      }
    >
      <div className="chw-strip">
        <div className="ex2-cw-scale">
          <span>0 – почти не было</span>
          <span>5 – где-то посередине</span>
          <span>10 – в полной мере</span>
        </div>
        {scene('chw-scene--strip')}
      </div>
      {NEEDS.map((n) => (
        <NeedRateRow key={n.id} need={n} value={unrated.includes(n.id) ? undefined : ratings[n.id]} onChange={(v) => onChange(n.id, v)} />
      ))}
      {error && (
        <PaperAlert
          className="chw-save-err"
          sign="wheel"
          title={tr(
            'Не удалось сохранить. Проверь связь и попробуй ещё раз.',
            'Не удалось сохранить. Проверьте связь и попробуйте ещё раз.',
          )}
        />
      )}
      <div className="ex2-foot">
        {onCancel && (
          <button type="button" className="ds-btn ds-btn--secondary" disabled={saving} onClick={onCancel}>
            Отмена
          </button>
        )}
        <span className="ex2-spacer" />
        {unrated.length > 0 && <span className="ex2-cw-left" role="status">{unratedHint(unrated.length)}</span>}
        <button type="button" className="ds-btn" disabled={saving || unrated.length > 0} aria-busy={saving || undefined} onClick={onSave}>
          {saving ? 'Сохраняю…' : <>Посмотреть результат <GlyphArrowRight /></>}
        </button>
      </div>
    </ExScreen>
  );
}
