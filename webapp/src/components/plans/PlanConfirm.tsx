// Шаг «Запланировать» листа плана: выбранное действие, время и сохранение.
// Развилка U5 (аудит 2026-11): человек без канала уведомлений (ни Telegram,
// ни веб-пушей) выбирал «Напомнить завтра», а напоминание не приходило.
// Без канала лист говорит это прямо и куда их включить, главная кнопка —
// «Добавить в календарь» (.ics с сигналом + сохранение плана), рядом —
// Google Календарь; с каналом — всё как раньше.
// b20: действие — белый лист Literata с тенью-слоем бумаги потребности (было розовой плашкой), предупреждение —
// наклейка соломы, время — плитки в ряд (на телефоне 2×2) с галочкой у выбранной, «Сохранить план» — залитая во
// всю колонку, «.ics» — под ней; ритм — зазор 24 между полями (блоки слипались).
import type { CSSProperties } from 'react';
import { GlyphCheck } from '../exercises/ExGlyphs';
import { useTr } from '../../utils/addressForm';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import { REMINDER_OPTIONS, type usePlanSheetState } from '../../../../shared/src/practices/usePlanSheetState';
import { planNoReminderNote } from '../../../../shared/src/practices/planReminderCopy';
import { planEventStartMs } from '../../../../shared/src/utils/planEventStart';
import { glueSpaces } from '../../../../shared/src/utils/typo';
import { buildGoogleCalendarUrl } from '../booking/googleCalendarLink';
import { reminderHour } from './planDoneModel';
import { PaperAlert } from '../paper/PaperAlert';

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
  const busy = s.saving ? '…' : null;

  return (
    <div className="sk-plan-confirm">
      <div className="sk-field">
        <div className="ds-label">Действие</div>
        <div className="sk-chosen" style={hue}>{glueSpaces(s.selectedText)}</div>
      </div>

      {calendarOnly && <p role="note" className="pp-paper sk-hint" style={{ '--h': 70 } as CSSProperties}>{planNoReminderNote(tr)}</p>}

      <div className="sk-field">
        <div className="ds-label">{calendarOnly ? 'Время в календаре' : 'Напомнить завтра'}</div>
        <div className="sk-slots">
          {options.map(({ opt, i }) => {
            const on = s.reminderIdx === i;
            return (
              <button key={i} type="button" aria-pressed={on} onClick={() => s.setReminderIdx(i)}
                className={'sk-slot' + (on ? ' is-on' : '')} style={hue}>
                <span className="sk-slot-label">{opt.label}</span>
                {opt.localHour !== null && <span className="sk-slot-hour">{reminderHour(opt.localHour)}</span>}
                {on && <span className="sk-slot-check" aria-hidden="true"><GlyphCheck /></span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sk-plan-actions-col">
        {calendarOnly ? (
          <>
            <button
              onClick={() => { if (!s.saving && !s.savedOk) s.handleIcsDownload(); save(); }}
              disabled={s.saving || s.savedOk}
              className="ds-btn ds-btn--lg sk-ics"
            >
              {busy ?? 'Добавить в календарь'}
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
            <button onClick={save} disabled={s.saving || s.savedOk} className="ds-link pa-quiet">
              Сохранить без календаря
            </button>
          </>
        ) : (
          <>
            <button onClick={save} disabled={s.saving || s.savedOk} className="ds-btn ds-btn--lg sk-ics">
              {busy ?? 'Сохранить план'}
            </button>
            {/* ICS download — паритет с мини-аппом, правило №16 */}
            <button onClick={s.handleIcsDownload} className="ds-btn ds-btn--secondary sk-ics">
              Добавить в календарь (.ics)
            </button>
          </>
        )}
      </div>

      {/* Сбои — наклейкой PaperAlert, как у соседей по листу (ревью g6 r2: шли голой красной строкой). */}
      {s.icsFailed && <PaperAlert className="sk-alert" sign="leaf" title={tr('Файл для календаря не открылся. Попробуй ещё раз.', 'Файл для календаря не открылся. Попробуйте ещё раз.')} />}
      {s.saveError && <PaperAlert className="sk-alert" sign="leaf" title={tr('Не удалось сохранить. Попробуй ещё раз.', 'Не удалось сохранить. Попробуйте ещё раз.')} />}
    </div>
  );
}
