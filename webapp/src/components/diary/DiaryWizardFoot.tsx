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
    <div className="ex-foot">
      <button
        className="ex-btn ex-btn-ghost"
        disabled={backDisabled}
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}
      >
        <GlyphArrowLeft /> {backLabel}
      </button>
      <span className="spacer" />
      {canSave && !isLast && (
        <button
          className="ex-btn ex-btn-ghost"
          disabled={saving}
          onClick={onSave}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}
        >
          {saving ? 'Сохраняю…' : 'Сохранить'} {!saving && <GlyphCheck />}
        </button>
      )}
      {isLast ? (
        <button
          className="ex-btn ex-btn-primary"
          disabled={!canSave || saving}
          onClick={onSave}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}
        >
          {saving ? 'Сохраняю…' : 'Сохранить запись'} {!saving && <GlyphCheck />}
        </button>
      ) : (
        <button
          className="ex-btn ex-btn-primary"
          disabled={curRequired && !curFilled}
          onClick={onNext}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}
        >
          {curFilled || curRequired ? 'Дальше' : 'Пропустить'} <GlyphArrowRight />
        </button>
      )}
    </div>
  );
}
