import { MMIcon } from '../../modeMapIcons';

/** «+ В план» у рубрики или пункта листа справочника: тихая ссылка в строке заголовка, открывает лист выбора частей (plan/PlanAddSheet). */
export function PlanButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ds-link gd-plan" aria-label={`В план: ${label}`} onClick={onClick}>
      <MMIcon name="plus" size={14} />В план
    </button>
  );
}
