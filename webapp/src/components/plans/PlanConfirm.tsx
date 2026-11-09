// Шаг «Запланировать» листа плана: выбранное действие, время и сохранение.
// Развилка U5 (аудит 2026-11): человек без канала уведомлений (ни Telegram,
// ни веб-пушей) выбирал «Напомнить завтра», а напоминание не приходило.
// Без канала лист говорит это прямо и куда их включить, главная кнопка —
// «Добавить в календарь» (.ics с сигналом + сохранение плана), рядом —
// Google Календарь; с каналом — всё как раньше.
import { GlyphCheck } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import { REMINDER_OPTIONS, type usePlanSheetState } from '../../../../shared/src/practices/usePlanSheetState';
import { planNoReminderNote } from '../../../../shared/src/practices/planReminderCopy';
import { planEventStartMs } from '../../../../shared/src/utils/planEventStart';
import { buildGoogleCalendarUrl } from '../booking/googleCalendarLink';

type PlanState = ReturnType<typeof usePlanSheetState>;

interface Props {
  s: PlanState;
  needId: string;
  needLabel: string;
}

export function PlanConfirm({ s, needId, needLabel }: Props) {
  const tr = useTr();
  const hue = hueStyle(NEED_HUE[needId as NeedId]);
  // null (настроек ещё нет) — как раньше: пугать без ответа сервера незачем.
  const calendarOnly = s.notifyReach === false;
  const options = REMINDER_OPTIONS.map((opt, i) => ({ opt, i }))
    .filter(({ opt }) => !calendarOnly || opt.localHour !== null);
  const save = () => {
    if (s.saving || s.savedOk) return;
    s.setSaveError(false);
    void s.handleSave();
  };
  const saveLabel = s.savedOk ? <><GlyphCheck /> Запланировано</> : s.saving ? '…' : null;

  return (
    <>
      <div className="sk-field">
        <div className="ds-label">Действие</div>
        <div className="sk-chosen tone-tint" style={hue}>{s.selectedText}</div>
      </div>

      {calendarOnly && <p role="note" className="sk-hint tone-tint" style={hue}>{planNoReminderNote(tr)}</p>}

      <div className="sk-field">
        <div className="ds-label">{calendarOnly ? 'Время в календаре' : 'Напомнить завтра'}</div>
        <div className="sk-list">
          {options.map(({ opt, i }) => (
            <div
              key={i}
              onClick={() => s.setReminderIdx(i)}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.setReminderIdx(i); } }}
              className={'ds-card ds-card--row ds-card--hover sk-opt' + (s.reminderIdx === i ? ' tone-border is-selected' : '')}
              style={hue}
            >
              <span>
                {opt.label}
                {opt.localHour !== null && <span className="ds-sub sk-hour">{String(opt.localHour).padStart(2, '0')}:00</span>}
              </span>
              {s.reminderIdx === i && <span className="sk-check"><GlyphCheck /></span>}
            </div>
          ))}
        </div>
      </div>

      {calendarOnly ? (
        <>
          <button
            onClick={() => { if (!s.saving && !s.savedOk) s.handleIcsDownload(); save(); }}
            disabled={s.saving || s.savedOk}
            className="ds-btn ds-btn--accent sk-ics"
          >
            {saveLabel ?? 'Добавить в календарь'}
          </button>
          <a
            href={buildGoogleCalendarUrl({
              title: s.selectedText,
              startsAt: new Date(planEventStartMs(REMINDER_OPTIONS[s.reminderIdx].localHour, s.tzOffset)).toISOString(),
              durationMin: 30,
              details: `Практика для потребности: ${needLabel}`,
            })}
            target="_blank" rel="noopener noreferrer"
            onClick={save}
            className="ds-btn ds-btn--secondary sk-ics"
          >
            Google Календарь ↗
          </a>
        </>
      ) : (
        /* ICS download — паритет с мини-аппом, правило №16 */
        <button onClick={s.handleIcsDownload} className="ds-btn ds-btn--secondary sk-ics">
          Добавить в календарь (.ics)
        </button>
      )}

      {s.icsFailed && <div role="alert" className="sk-error sk-center">{tr('Файл для календаря не открылся. Попробуй ещё раз.', 'Файл для календаря не открылся. Попробуйте ещё раз.')}</div>}
      {s.saveError && (
        <div className="sk-error sk-center">
          {tr('Не удалось сохранить. Попробуй ещё раз.', 'Не удалось сохранить. Попробуйте ещё раз.')}
        </div>
      )}

      <div className="sk-foot">
        {calendarOnly ? (
          <button onClick={save} disabled={s.saving || s.savedOk} className="ds-link">
            Сохранить без календаря
          </button>
        ) : (
          <button
            onClick={save}
            disabled={s.saving || s.savedOk}
            className={'ds-btn ' + (s.savedOk ? 'ds-btn--secondary' : 'ds-btn--accent')}
          >
            {saveLabel ?? 'Сохранить план'}
          </button>
        )}
      </div>
    </>
  );
}
