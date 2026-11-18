/** «В план» у рубрики или пункта листа справочника: открывает лист выбора частей (plan/PlanAddSheet). */
export function PlanButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" aria-label={`В план: ${label}`} onClick={onClick}>
      В план
    </button>
  );
}
