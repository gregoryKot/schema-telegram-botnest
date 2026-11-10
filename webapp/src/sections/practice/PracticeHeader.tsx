import { useTr } from '../../utils/addressForm';
import { SelfHelpEntry } from './SelfHelpEntry';
import { CustomizeLink } from '../../components/customize/CustomizeGear';
import { therapistNameLine } from '../../../../shared/src/therapy/therapistLinkCopy';
import { glue, glueSpaces } from '../../../../shared/src/utils/typo';
import '../../styles/practice-selfhelp.css';

export interface SessionBannerInfo { label: string; isToday: boolean; partnerName?: string | null }

// « · Терапевт: Имя»: «·» и «Терапевт:» держатся с соседним словом; имя — данные человека (glueSpaces), переносится (g4 r5).
const partnerTail = (name: string) => glueSpaces(` · ${therapistNameLine(name.trim()).replace(/^(\S+:) +/, '$1\u00a0')}`);

/** Шапка «Практики»: надпись, заголовок, подпись, встреча; справа в ряду надписи — «Важное о самопомощи» (знак Limits вместо ⚠,
 * читался ошибкой) и «Настроить инструменты» (в ряд с заголовком не влезали уже на 1280). Телефон: в шапке только «Настроить»,
 * «Важное» — под вводной практик (HereAndNowIntro); страница начинается с «Здесь и сейчас», заголовок зовётся так же (#906). */
export function PracticeHeader({ phone, banner, onCustomize }: { phone: boolean; banner: SessionBannerInfo | null; onCustomize: () => void }) {
  const tr = useTr();
  return (
    <div className="cp-head">
      <div className="cp-head-row">
        <div className="ds-eyebrow">Практики</div>
        <span className="cp-head-end">{!phone && <SelfHelpEntry />}<CustomizeLink label="Настроить инструменты" onClick={onCustomize} /></span>
      </div>
      <h1 className="ds-h1">{phone ? 'Здесь и сейчас' : <>Упражнения <i>{glue('и задания')}</i></>}</h1>
      <p className="ds-sub cp-head-sub">
        {phone
          ? tr('Тяжёлый момент? Начни с одного вдоха', 'Тяжёлый момент? Начните с одного вдоха')
          : tr('Восемь упражнений схема-терапии плюс твои личные цели.', 'Восемь упражнений схема-терапии плюс ваши личные цели.')}
      </p>
      {banner && (
        <div className={'ds-sub cp-head-banner' + (banner.isToday ? ' is-today' : '')}>
          {banner.isToday ? '● Сегодня встреча' : `Следующая встреча: ${banner.label}`}
          {banner.partnerName && <span>{partnerTail(banner.partnerName)}</span>}
        </div>
      )}
    </div>
  );
}
