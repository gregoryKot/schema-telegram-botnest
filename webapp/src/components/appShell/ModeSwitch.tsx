// Переключатель «Клиент · Терапевт» — один компонент на два места (#902):
// сайдбар (variant="sidebar", тёмный на --ink, стили .sb-mode-switch в
// index.css) и лист настроек (variant="sheet", светлый, .sb-mode-switch--sheet
// в styles/sheet-settings.css). На телефоне сайдбар скрыт, и до #902 из
// кабинета не было пути обратно в режим клиента.
// Клик по уже активному режиму onChange не зовёт: в листе выбор закрывает
// лист, и повторный тап по текущему режиму не должен выбрасывать из настроек.
interface Props {
  /** true — кабинет терапевта, false — режим клиента. */
  value: boolean;
  onChange: (on: boolean) => void;
  variant: 'sidebar' | 'sheet';
}

export function ModeSwitch({ value, onChange, variant }: Props) {
  const pick = (on: boolean) => { if (on !== value) onChange(on); };
  const btn = (on: boolean, label: string) => (
    <button type="button" className={`sb-mode-btn${on === value ? ' is-active' : ''}`}
            aria-pressed={on === value} onClick={() => pick(on)}>{label}</button>
  );
  return (
    <div role="group" aria-label="Режим" className={`sb-mode-switch${variant === 'sheet' ? ' sb-mode-switch--sheet' : ''}`}>
      {btn(false, 'Клиент')}
      {btn(true, 'Терапевт')}
    </div>
  );
}
