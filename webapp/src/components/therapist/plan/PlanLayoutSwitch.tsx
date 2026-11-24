import { LineTabs } from '../../LineTabs';

export type PlanLayout = 'phases' | 'channels';

const OPTIONS = [
  { id: 'phases', label: 'По фазам' },
  { id: 'channels', label: 'По каналам' },
] as const;

/** Раскладка плана: по фазам пути клиента или по каналам справочника. Вид, а не раздел — тихая пара. Выбор живёт, пока открыта вкладка. */
export function PlanLayoutSwitch({ value, onChange }: { value: PlanLayout; onChange: (v: PlanLayout) => void }) {
  return <LineTabs look="quiet" label="Раскладка плана" tabs={OPTIONS} value={value} onPick={onChange} />;
}
