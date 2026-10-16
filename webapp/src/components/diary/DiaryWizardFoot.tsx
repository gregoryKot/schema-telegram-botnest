import { GlyphArrowLeft, GlyphArrowRight, GlyphCheck } from '../exercises/ExScreen';

// Подвал визарда дневника: Назад / ранний «Сохранить» (не проходя все шаги,
// низкий порог для СДВГ) / Дальше-Пропустить-«Сохранить запись» на последнем
// шаге. Общий для ModeEntryForm/SchemaEntrySheet (правило №11 CLAUDE.md,
// jscpd-свип при переводе дневника схем на визард).
export function DiaryWizardFoot({
  onBack,
  backLabel = 'Назад',
  backDisabled,
  canSave,
  isLast,
  saving,
  onSave,
  curFilled,
  curRequired,
  onNext,
}: {
  onBack: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  canSave: boolean;
  isLast: boolean;
  saving: boolean;
  onSave: () => void;
  curFilled: boolean;
  curRequired: boolean;
  onNext: () => void;
}) {
  return (
    <div className="sd-foot">
      <button
        className="ds-btn ds-btn--secondary"
        disabled={backDisabled}
        onClick={onBack}
      >
        <GlyphArrowLeft /> {backLabel}
      </button>
      <span className="sd-spacer" />
      {canSave && !isLast && (
        <button
          className="ds-btn ds-btn--secondary"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Сохраняю…' : 'Сохранить'} {!saving && <GlyphCheck />}
        </button>
      )}
      {isLast ? (
        <button
          className="ds-btn"
          disabled={!canSave || saving}
          onClick={onSave}
        >
          {saving ? 'Сохраняю…' : 'Сохранить запись'} {!saving && <GlyphCheck />}
        </button>
      ) : (
        <button
          className="ds-btn"
          disabled={curRequired && !curFilled}
          onClick={onNext}
        >
          {curFilled || curRequired ? 'Дальше' : 'Пропустить'} <GlyphArrowRight />
        </button>
      )}
    </div>
  );
}
