import { useTr } from '../../utils/addressForm';
import { Leaf } from '../../components/art/PaperArtSigns';
import { SettingsGear, CustomizeLink } from '../../components/customize/CustomizeGear';
import { clientHue, hueStyle } from '../../lib/tone';
import { glue } from '../../../../shared/src/utils/typo';
import { avatarInitial, daysWord } from './profileModel';

interface Props { displayName: string | null | undefined; totalDays: number; onCustomize: () => void; onOpenSettings?: () => void }

// Одна шапка на любой ширине (#906): герой-блок — аватар, «Профиль / Мой путь / N дней с тобой», Leaf, ссылка «Настроить экран» и шестерёнка.
export function ProfileHeader({ displayName, totalDays, onCustomize, onOpenSettings }: Props) {
  const tr = useTr();
  const name = displayName?.trim() ?? '';
  return (
    <div className="pp-block pp-block--head cpf-block"><div className="cpf-head">
      <div className="ds-avatar ds-avatar--serif cpf-avatar" style={hueStyle(clientHue(name || 'me'))} aria-hidden="true">
        {avatarInitial(name)}
      </div>
      <div className="cpf-head-text">
        <div className="ds-eyebrow">Профиль</div>
        <h1 className="ds-h1">Мой <i>путь</i></h1>
        {(name || totalDays > 0) && (
          <div className="ds-sub cpf-head-sub">
            {name && <span className="cpf-head-name">{name}</span>}{name && totalDays > 0 ? ' · ' : ''}
            {totalDays > 0 && glue(`${totalDays} ${daysWord(totalDays)} ${tr('с тобой', 'с вами')} в приложении`)}
          </div>
        )}
      </div>
      <Leaf size="hero" />
      <div className="cpf-head-actions">
        <CustomizeLink onClick={onCustomize} />
        {onOpenSettings && <SettingsGear onClick={onOpenSettings} />}
      </div>
    </div></div>
  );
}
