import { useTr } from '../../utils/addressForm';
import { SelfHelpEntry } from './SelfHelpEntry';
import { CustomizeLink } from '../../components/customize/CustomizeGear';
import '../../styles/practice-selfhelp.css';

export interface SessionBannerInfo { label: string; isToday: boolean; partnerName?: string | null }

/**
 * Шапка «Практики» — один состав на любой ширине (#906): надпись, заголовок со
 * значком «Важное о самопомощи», ссылка «Настроить инструменты», подпись.
 * Телефон меняет только слова: там страница начинается с «Здесь и сейчас»
 * (дыхание первым, как «Помощь» в мини-аппе), и заголовок зовётся так же.
 */
export function PracticeHeader({ phone, banner, onCustomize }: { phone: boolean; banner: SessionBannerInfo | null; onCustomize: () => void }) {
  const tr = useTr();
  return (
    <div>
      <div className="ds-eyebrow">Практика</div>
      <div className="cp-head-row">
        <h1 className="ds-h1">{phone ? 'Здесь и сейчас' : <>Упражнения <i>и задания</i></>}</h1>
        <SelfHelpEntry />
        <span className="cp-head-end"><CustomizeLink label="Настроить инструменты" onClick={onCustomize} /></span>
      </div>
      <p className="ds-sub cp-head-sub">
        {phone
          ? tr('Тяжёлый момент? Начни с одного вдоха', 'Тяжёлый момент? Начните с одного вдоха')
          : tr('Восемь практик схема-терапии плюс твои личные цели.', 'Восемь практик схема-терапии плюс ваши личные цели.')}
      </p>
      {banner && (
        <div className={'ds-sub cp-head-banner' + (banner.isToday ? ' is-today' : '')}>
          {banner.isToday ? '● Сегодня встреча' : `Следующая встреча: ${banner.label}`}
          {banner.partnerName && <span> · с {banner.partnerName}</span>}
        </div>
      )}
    </div>
  );
}
