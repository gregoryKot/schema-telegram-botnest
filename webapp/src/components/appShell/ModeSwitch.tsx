// Переключатель «Клиент · Терапевт» — один компонент на два места (#902): сайдбар (variant="sidebar", песочная --panel,
// .sb-mode-switch в index.css) и лист настроек (variant="sheet"); оба — LineTabs fill. На телефоне сайдбар скрыт.
// Клик по уже активному режиму onChange не зовёт: в листе выбор закрывает лист, и повторный тап по текущему
// режиму не должен выбрасывать из настроек.
import { LineTabs } from '../LineTabs';

interface Props {
  /** true — кабинет терапевта, false — режим клиента. */
  value: boolean;
  onChange: (on: boolean) => void;
  variant: 'sidebar' | 'sheet';
}

type Mode = 'client' | 'therapist';
const MODES = [{ id: 'client', label: 'Клиент' }, { id: 'therapist', label: 'Терапевт' }] as const;

export function ModeSwitch({ value, onChange, variant }: Props) {
  const pick = (id: Mode) => { const on = id === 'therapist'; if (on !== value) onChange(on); };
  return (
    <LineTabs look="fill" label="Режим" tabs={MODES} value={value ? 'therapist' : 'client'} onPick={pick}
              className={variant === 'sidebar' ? 'sb-mode-switch' : undefined} />
  );
}
