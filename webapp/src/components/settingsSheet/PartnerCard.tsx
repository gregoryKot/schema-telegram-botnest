import { useTr } from '../../utils/addressForm';
import type { PairsData } from '../../../../shared/src/apiTypes';
import {
  indexTone,
  partnerContextText,
  weekBars,
  PARTNER_EMPTY_TEXT,
} from '../../../../shared/src/pair/partnerCard';

type Partner = PairsData['partners'][number];

// Карточка партнёра в паре на сайте — парная к мини-аппу (правило №3): индекс
// дня, недельные бары, «Написать», контекстная фраза, выход с подтверждением.
// Логика и пороги — shared/src/pair/partnerCard.ts, цвета — токены через
// классы st-pc-tone--* (sheet-settings.css). Выход из пары разрывает связь у
// обоих, поэтому первый тап только просит подтверждение.
export function PartnerCard({ partner, confirmLeaveCode, setConfirmLeaveCode, onLeave, leaveError }: {
  partner: Partner;
  confirmLeaveCode: string | null;
  setConfirmLeaveCode: (code: string | null) => void;
  onLeave: (code: string) => void;
  leaveError?: boolean;
}) {
  const tr = useTr();
  const name = partner.partnerName ?? 'Друг';
  const idx = partner.partnerIndex;
  const done = partner.partnerTodayDone && idx !== null;
  const bars = weekBars(partner.partnerWeekAvgs);

  return (
    <div className="st-pc">
      <div className="st-pc-top">
        <div>
          <div className="st-text">{name} сегодня</div>
          {done
            ? <div className={`st-pair-num st-pc-tone--${indexTone(idx)}`}>{idx.toFixed(1)}<small>/10</small></div>
            : <div className="st-text">{PARTNER_EMPTY_TEXT}</div>}
        </div>
        {partner.partnerTelegramId && (
          <a className="ds-btn ds-btn--sm ds-btn--secondary st-pc-write" href={`tg://user?id=${partner.partnerTelegramId}`}>Написать</a>
        )}
      </div>

      {bars.length > 0 && (
        <div className="st-pc-bars" aria-hidden="true">
          {bars.map((bar, i) => (
            <div key={i} className="st-pc-bar">
              <i className={bar.tone === 'none' ? undefined : `st-pc-tone--${bar.tone}`} style={{ height: bar.px }} />
              {bar.today && <small>сег</small>}
            </div>
          ))}
        </div>
      )}

      <div className="st-text">{partnerContextText(name, done, idx ?? 0)}</div>

      {leaveError && <div className="st-err">{tr('Не удалось выйти из пары. Попробуй ещё раз', 'Не удалось выйти из пары. Попробуйте ещё раз')}</div>}

      {confirmLeaveCode === partner.code ? (
        <div className="st-pc-confirm">
          <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setConfirmLeaveCode(null)}>Отмена</button>
          <button className="ds-btn ds-btn--sm ds-btn--secondary st-btn-danger is-solid" onClick={() => onLeave(partner.code)}>Выйти</button>
        </div>
      ) : (
        <button className="ds-link st-link-danger st-pc-leave" onClick={() => setConfirmLeaveCode(partner.code)}>Выйти из пары</button>
      )}
    </div>
  );
}
