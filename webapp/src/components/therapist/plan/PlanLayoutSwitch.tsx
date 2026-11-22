export type PlanLayout = 'phases' | 'channels';

const OPTIONS: { id: PlanLayout; label: string }[] = [
  { id: 'phases', label: 'По фазам' },
  { id: 'channels', label: 'По каналам' },
];

/** Раскладка плана: по фазам пути клиента или по каналам справочника. Выбор живёт, пока открыта вкладка. */
export function PlanLayoutSwitch({ value, onChange }: { value: PlanLayout; onChange: (v: PlanLayout) => void }) {
  return (
    <div className="ds-seg ds-seg--full" role="group" aria-label="Раскладка плана">
      {OPTIONS.map((o) => (
        <button
          key={o.id} type="button" aria-pressed={value === o.id}
          className={`ds-seg-btn${value === o.id ? ' is-active' : ''}`} onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
