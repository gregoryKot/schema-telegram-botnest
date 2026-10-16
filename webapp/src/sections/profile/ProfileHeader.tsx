import { useTr } from '../../utils/addressForm';
import { clientHue, hueStyle } from '../../lib/tone';
import { avatarInitial, daysWord } from './profileModel';

interface Props { displayName: string | null | undefined; totalDays: number }

export function ProfileHeader({ displayName, totalDays }: Props) {
  const tr = useTr();
  const name = displayName?.trim() ?? '';
  const parts = [name, totalDays > 0 ? `${totalDays} ${daysWord(totalDays)} ${tr('с тобой в приложении', 'с вами в приложении')}` : ''].filter(Boolean);
  return (
    <div className="cpf-head">
      <div className="ds-avatar ds-avatar--serif cpf-avatar" style={hueStyle(clientHue(name || 'me'))} aria-hidden="true">
        {avatarInitial(name)}
      </div>
      <div className="cpf-head-text">
        <div className="ds-eyebrow">Профиль</div>
        <h1 className="ds-h1">Мой <i>путь</i></h1>
        {parts.length > 0 && <div className="cpf-head-sub">{parts.join(' · ')}</div>}
      </div>
    </div>
  );
}
