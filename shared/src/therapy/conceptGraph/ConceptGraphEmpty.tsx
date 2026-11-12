import { useConceptPaper } from './conceptPaper';

export const EMPTY_START_LABEL = 'Отметить схемы';

/**
 * Пустая схема случая (редизайн 2026-11, b32): одна сцена и одно главное
 * действие вместо трёх пунктирных заготовок. «Отметить схемы» открывает тот же
 * выбор, что «+ схема»; с открытым выбором ConceptGraph показывает диаграмму с
 * заголовками секций — оттуда же ставятся режимы. Сцену даёт сайт
 * (SceneConceptStart); в картинку схемы пустое состояние не идёт.
 */
export function ConceptGraphEmpty({ onStart }: { onStart: () => void }) {
  const paper = useConceptPaper();
  return (
    <div data-export-skip data-concept-empty className="cg-empty">
      {paper?.emptyScene}
      <button
        type="button"
        className="ds-btn ds-btn--primary"
        onClick={onStart}
      >
        {EMPTY_START_LABEL}
      </button>
    </div>
  );
}
