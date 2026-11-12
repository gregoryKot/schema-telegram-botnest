import { useTr } from '../../utils/addressForm';
import type { PairsData } from '../../../../shared/src/apiTypes';
import {
  indexTone,
  partnerContextText,
  weekBars,
  PARTNER_EMPTY_TEXT,
} from '../../../../shared/src/pair/partnerCard';
import { telegramChatUrl } from '../../../../shared/src/utils/therapistContact';
import { fmtIndex } from '../../../../shared/src/needs/dayIndex';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';

type Partner = PairsData['partners'][number];

// Карточка партнёра в паре: индекс дня, недельные бары, «Написать», фраза, выход с подтверждением.
// Вид (b25): лист бумаги оттенка пары (ENTITY_LOOK.pair, глина) без знака; столбики стоят на одной
// линии, подписи дней — отдельным рядом под ними (подпись «сег» раньше поднимала последний столбик).
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
  // Веб-аккаунт (Google/VK/MAX/почта) — не Telegram-id: tg:// вёл в никуда, ссылки нет.
  const chatUrl = partner.partnerTelegramId === null ? null : telegramChatUrl(partner.partnerTelegramId);

  return (
    <div className="pp-paper st-pc" style={hueStyle(ENTITY_LOOK.pair.hue)}>
      <div className="st-pc-top">
        <div>
          <div className="st-text">{name} сегодня</div>
          {done
            ? <div className={`st-pair-num st-pc-tone--${indexTone(idx)}`}>{fmtIndex(idx)}<small>/10</small></div>
            : <div className="st-text">{PARTNER_EMPTY_TEXT}</div>}
        </div>
        {chatUrl && (
          <a className="ds-btn ds-btn--sm ds-btn--secondary" href={chatUrl}>Написать</a>
        )}
      </div>

      {bars.length > 0 && (
        <div className="st-pc-week" aria-hidden="true">
          <div className="st-pc-bars">
            {bars.map((bar, i) => (
              <i key={i} className={`st-pc-bar${bar.tone === 'none' ? '' : ` st-pc-tone--${bar.tone}`}`} style={{ height: bar.px }} />
            ))}
          </div>
          <div className="st-pc-days">
            {bars.map((bar, i) => <small key={i} className="st-pc-day">{bar.today ? 'сег' : ''}</small>)}
          </div>
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
        <button className="ds-link ds-link--danger" onClick={() => setConfirmLeaveCode(partner.code)}>Выйти из пары</button>
      )}
    </div>
  );
}
