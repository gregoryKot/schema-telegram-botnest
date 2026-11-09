import { SSection, SRow } from './ui';
import { ModeSwitch } from '../appShell/ModeSwitch';
import { ResignTherapistBlock } from './ResignTherapistBlock';

// Первый блок настроек терапевта — выбор режима (#902). onSelect приходит только
// для режима, отличного от текущего (ModeSwitch); родитель закрывает лист и
// переключает режим — человек оказывается в выбранном режиме, а не в настройках.
// Под переключателем — вход на /account (способы входа, 2FA, выход): страница
// вне AppShell, а с телефона из кабинета другого пути к ней нет (у клиента он
// в разделе «Профиль»). Последним — снятие роли (до 2026-11 — в «Оформлении»).
export function ModeSection({ therapistMode, onSelect, onOpenAccount, onResign }: {
  therapistMode: boolean; onSelect: (on: boolean) => void; onOpenAccount: () => void; onResign?: () => Promise<void> | void;
}) {
  return (
    <SSection id="s-mode" label="Режим" hint="Кабинет терапевта — клиенты и концептуализации · Режим клиента — свой дневник и практики">
      <div className="st-body-block">
        <ModeSwitch variant="sheet" value={therapistMode} onChange={onSelect} />
      </div>
      <SRow title="Аккаунт и способы входа" sub="Привязки, двухфакторная защита, выход" onClick={onOpenAccount} />
      {onResign && <ResignTherapistBlock onResign={onResign} />}
    </SSection>
  );
}
