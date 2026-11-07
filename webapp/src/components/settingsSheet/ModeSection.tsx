import { SSection, SRow } from './ui';
import { ModeSwitch } from '../appShell/ModeSwitch';

// Первый блок настроек терапевта — выбор режима (#902). До него переключатель
// жил только в сайдбаре (на телефоне скрыт) и тумблером «Режим специалиста»
// в «Оформлении» — не то место для роли. onSelect приходит только для режима,
// отличного от текущего (ModeSwitch); родитель закрывает лист и переключает
// режим — человек оказывается в выбранном режиме, а не остаётся в настройках.
// Под переключателем — вход на /account (способы входа, 2FA, выход): страница
// вне AppShell, а с телефона из кабинета другого пути к ней нет (у клиента он
// в разделе «Профиль»). Родитель так же закрывает лист, затем переходит.
export function ModeSection({ therapistMode, onSelect, onOpenAccount }: {
  therapistMode: boolean; onSelect: (on: boolean) => void; onOpenAccount: () => void;
}) {
  return (
    <SSection id="s-mode" label="Режим" hint="Кабинет терапевта — клиенты и концептуализации · Режим клиента — свой дневник и практики">
      <div className="st-body-block">
        <ModeSwitch variant="sheet" value={therapistMode} onChange={onSelect} />
      </div>
      <SRow title="Аккаунт и способы входа" sub="Привязки, двухфакторная защита, выход" onClick={onOpenAccount} />
    </SSection>
  );
}
