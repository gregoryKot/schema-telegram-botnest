// Чип-кнопка визитки: день/время слота, канал связи, валюта (одна механика — один компонент).
// Вид — чип на линии (.pa-chip--line, paper-app.css): ряд кладётся в .pa-chips-line.
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={active ? 'ds-chip pa-chip pa-chip--line is-on' : 'ds-chip pa-chip pa-chip--line'}>{children}</button>
  );
}
