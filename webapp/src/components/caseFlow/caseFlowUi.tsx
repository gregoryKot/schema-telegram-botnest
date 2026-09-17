import { CaseSupportBlock } from './CaseSupportFoot';

/**
 * Примитивы, общие для всех экранов потока «Разбор случая» (webapp): нижняя
 * панель (Дописать потом / Дальше) + карточка поддержки со строкой «Тяжело
 * прямо сейчас» — на каждом экране потока (правило №7 CLAUDE.md), не только
 * там, где стоит текстовое поле. Twin по смыслу с schema-miniapp
 * CaseHeader/CaseSupportFoot, разметка — webapp-идиома (ex-btn/ex-foot).
 * TertiaryLink переехала в caseLinks.tsx (иначе цикл модулей с
 * CaseSupportFoot); реэкспорт сохраняет прежний импорт для экранов.
 */
export { TertiaryLink } from './caseLinks';

/**
 * Нижняя панель шага: [Дописать потом] … [Дальше/Пропустить] сверху,
 * карточка поддержки и «Тяжело прямо сейчас →» снизу (CaseSupportBlock) —
 * одинаковая структура на scene/mode/body/impulse/criterion/recognition/
 * name/done, отличается только primaryLabel/primaryDisabled/onPrimary у
 * вызывающего экрана. onLater отсутствует на hook (там ещё нечего
 * дописывать) — экран сам решает.
 */
export function CaseFlowFoot({
  primaryLabel,
  primaryDisabled,
  onPrimary,
  onLater,
  crisis,
  onHardNow,
}: {
  /** Опущен на экранах, где сам тап по варианту продвигает поток (выбор
   *  режима) — отдельной кнопки «Дальше» там нет. */
  primaryLabel?: string;
  primaryDisabled?: boolean;
  onPrimary?: () => void;
  onLater?: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  return (
    <>
      {(onLater || primaryLabel) && (
        <div className="ex-foot">
          {onLater && (
            <button
              type="button"
              className="ex-btn ex-btn-ghost"
              onClick={onLater}
            >
              Дописать потом
            </button>
          )}
          <span className="spacer" />
          {primaryLabel && onPrimary && (
            <button
              type="button"
              className="ex-btn ex-btn-primary"
              disabled={primaryDisabled}
              onClick={onPrimary}
            >
              {primaryLabel}
            </button>
          )}
        </div>
      )}
      <CaseSupportBlock crisis={crisis} onHardNow={onHardNow} />
    </>
  );
}
