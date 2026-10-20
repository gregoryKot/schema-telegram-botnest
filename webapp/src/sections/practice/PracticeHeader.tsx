import { useTr } from '../../utils/addressForm';
import { SelfHelpEntry } from './SelfHelpEntry';
import '../../styles/practice-selfhelp.css';

export interface SessionBannerInfo { label: string; isToday: boolean; partnerName?: string | null }

/**
 * Шапка «Практики». На телефоне — как «Помощь» в мини-аппе: заголовок одной
 * строкой и подпись, без капса-эйбрау; блок помощи идёт сразу под ней.
 */
export function PracticeHeader({ phone, banner }: { phone: boolean; banner: SessionBannerInfo | null }) {
  const tr = useTr();
  return (
    <div>
      {phone ? (
        <>
          <div className="cp-head-row">
            <h1 className="ds-h1">Здесь и сейчас</h1>
            <SelfHelpEntry />
          </div>
          <p className="ds-sub cp-phone-sub">
            {tr('Тяжёлый момент? Начни с одного вдоха', 'Тяжёлый момент? Начните с одного вдоха')}
          </p>
        </>
      ) : (
        <>
          <div className="ds-eyebrow">Практика</div>
          <div className="cp-head-row">
            <h1 className="ds-h1">Упражнения <i>и задания</i></h1>
            <SelfHelpEntry />
          </div>
          <p className="ds-sub" style={{ fontSize: 15, marginTop: 12 }}>
            {tr('Восемь практик схема-терапии плюс твои личные цели.', 'Восемь практик схема-терапии плюс ваши личные цели.')}
          </p>
        </>
      )}
      {banner && (
        <div className="ds-sub" style={{ marginTop: 8, color: banner.isToday ? 'var(--ok-ink)' : undefined }}>
          {banner.isToday ? '● Сегодня встреча' : `Следующая встреча: ${banner.label}`}
          {banner.partnerName && <span> · с {banner.partnerName}</span>}
        </div>
      )}
    </div>
  );
}
