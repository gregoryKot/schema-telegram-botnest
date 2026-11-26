import { SSection, SRow } from './ui';
import { ModeSwitch } from '../appShell/ModeSwitch';

// Первый блок настроек терапевта — выбор режима (#902). onSelect приходит только
// для другого режима (ModeSwitch); родитель закрывает лист и переключает режим.
// Под переключателем — вход на /account (способы входа, 2FA, выход): страница
// вне AppShell, а с телефона из кабинета другого пути к ней нет (у клиента он
// в разделе «Профиль»). Снятие роли — в «Данных» (b25). Пояснение — по строке на режим (К30).
export function ModeSection({ therapistMode, onSelect, onOpenAccount }: {
  therapistMode: boolean; onSelect: (on: boolean) => void; onOpenAccount: () => void;
}) {
  return (
    <SSection id="s-mode" label="Режим" hint={<><span className="st-hint-line">Кабинет терапевта — клиенты и концептуализации</span>
      <span className="st-hint-line">Режим клиента — свой дневник и практики</span></>}>
      <div className="st-body-block st-mode-block">
        <ModeSwitch variant="sheet" value={therapistMode} onChange={onSelect} />
      </div>
      <SRow title="Аккаунт и способы входа" sub="Привязки, двухфакторная защита, выход" onClick={onOpenAccount} />
    </SSection>
  );
}
