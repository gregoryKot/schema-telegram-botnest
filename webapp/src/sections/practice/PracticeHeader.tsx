import { useTr } from '../../utils/addressForm';
import { SelfHelpEntry } from './SelfHelpEntry';
import { CustomizeLink } from '../../components/customize/CustomizeGear';
import { therapistNameLine } from '../../../../shared/src/therapy/therapistLinkCopy';
import '../../styles/practice-selfhelp.css';

export interface SessionBannerInfo { label: string; isToday: boolean; partnerName?: string | null }

/** Шапка «Практики»: надпись, заголовок, подпись, встреча; в ряду надписи справа — тихие ссылки
 * «Важное о самопомощи» (знак Limits вместо ⚠, который читался ошибкой) и «Настроить инструменты»
 * (в ряд с заголовком они не влезали уже на 1280). Телефон: в шапке только «Настроить», «Важное» —
 * под вводной практик (HereAndNowIntro); страница там начинается с «Здесь и сейчас», и заголовок
 * зовётся так же (#906). */
export function PracticeHeader({ phone, banner, onCustomize }: { phone: boolean; banner: SessionBannerInfo | null; onCustomize: () => void }) {
  const tr = useTr();
  return (
    <div className="cp-head">
      <div className="cp-head-row">
        <div className="ds-eyebrow">Практики</div>
        <span className="cp-head-end">{!phone && <SelfHelpEntry />}<CustomizeLink label="Настроить инструменты" onClick={onCustomize} /></span>
      </div>
      <h1 className="ds-h1">{phone ? 'Здесь и сейчас' : <>Упражнения <i>и задания</i></>}</h1>
      <p className="ds-sub cp-head-sub">
        {phone
          ? tr('Тяжёлый момент? Начни с одного вдоха', 'Тяжёлый момент? Начните с одного вдоха')
          : tr('Восемь упражнений схема-терапии плюс твои личные цели.', 'Восемь упражнений схема-терапии плюс ваши личные цели.')}
      </p>
      {banner && (
        <div className={'ds-sub cp-head-banner' + (banner.isToday ? ' is-today' : '')}>
          {banner.isToday ? '● Сегодня встреча' : `Следующая встреча: ${banner.label}`}
          {banner.partnerName && <span> · {therapistNameLine(banner.partnerName)}</span>}
        </div>
      )}
    </div>
  );
}
