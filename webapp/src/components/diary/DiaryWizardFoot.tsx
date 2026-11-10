import { haptic } from '../../haptic';
import { GlyphArrowLeft, GlyphArrowRight, GlyphCheck } from '../exercises/ExScreen';

// Подвал визарда дневника: Назад / ранний «Сохранить» (не проходя все шаги,
// низкий порог для СДВГ) / Дальше-Пропустить-«Сохранить запись» на последнем
// шаге. Общий для ModeEntryForm/SchemaEntrySheet (правило №11 CLAUDE.md).
// Одна строка на любой ширине (2026-11: на 390 «Дальше» уезжал под «Назад»):
// уже 560px «Назад» — круг 44 со стрелкой (имя — aria-label), главная — на
// остаток строки. Раскладку держит DiaryWizardFoot.test.tsx.
export function DiaryWizardFoot({ onBack, backLabel = 'Назад', backDisabled, canSave, isLast, saving, onSave, curFilled, curRequired, onNext }: {
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
    <div className="sd-wfoot">
      <button className="ds-btn ds-btn--secondary sd-wfoot-back" aria-label={backLabel} disabled={backDisabled}
        onClick={() => { haptic.tap(); onBack(); }}>
        <GlyphArrowLeft /> <span className="sd-wfoot-back-label" aria-hidden="true">{backLabel}</span>
      </button>
      {canSave && !isLast && (
        <button
          className="ds-btn ds-btn--secondary sd-wfoot-save"
          disabled={saving} aria-busy={saving || undefined}
          onClick={onSave}
        >
          {saving ? 'Сохраняю…' : 'Сохранить'} {!saving && <GlyphCheck />}
        </button>
      )}
      {isLast ? (
        <button
          className="ds-btn sd-wfoot-next"
          disabled={!canSave || saving}
          onClick={onSave}
        >
          {saving ? 'Сохраняю…' : 'Сохранить запись'} {!saving && <GlyphCheck />}
        </button>
      ) : (
        <button className="ds-btn sd-wfoot-next" disabled={curRequired && !curFilled} onClick={() => { haptic.tap(); onNext(); }}>
          {curFilled || curRequired ? 'Дальше' : 'Пропустить'} <GlyphArrowRight />
        </button>
      )}
    </div>
  );
}
