import { useTr } from '../../utils/addressForm';
import { clientHue, hueStyle } from '../../lib/tone';
import { avatarInitial, daysWord } from './profileModel';

interface Props { displayName: string | null | undefined; totalDays: number; onOpenSettings?: () => void }

// Десктоп: «ПРОФИЛЬ / Мой путь / Аня · N дней с тобой в приложении».
// Телефон (css, .cpf-head-desk прячется): «Аня / N дней в приложении» и справа «Настроить» — как в мини-аппе.
export function ProfileHeader({ displayName, totalDays, onOpenSettings }: Props) {
  const tr = useTr();
  const name = displayName?.trim() ?? '';
  return (
    <div className="cpf-head">
      <div className="ds-avatar ds-avatar--serif cpf-avatar" style={hueStyle(clientHue(name || 'me'))} aria-hidden="true">
        {avatarInitial(name)}
      </div>
      <div className="cpf-head-text">
        <div className="ds-eyebrow cpf-head-desk">Профиль</div>
        <h1 className="ds-h1">
          <span className="cpf-head-desk">Мой <i>путь</i></span>
          <span className="cpf-head-mob">{name || 'Я'}</span>
        </h1>
        {(name || totalDays > 0) && (
          <div className="cpf-head-sub">
            {name && <span className="cpf-head-desk">{name}{totalDays > 0 ? ' · ' : ''}</span>}
            {totalDays > 0 && (
              <>
                {totalDays} {daysWord(totalDays)}
                <span className="cpf-head-desk"> {tr('с тобой', 'с вами')}</span> в приложении
              </>
            )}
          </div>
        )}
      </div>
      {onOpenSettings && (
        <button type="button" className="cpf-head-settings" onClick={onOpenSettings}>Настроить</button>
      )}
    </div>
  );
}
