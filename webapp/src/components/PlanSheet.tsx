import { api } from '../api';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { NEED_HUE, hueStyle } from '../lib/tone';
import type { NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tasks.css';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import {
  usePlanSheetState,
  REMINDER_OPTIONS,
} from '../../../shared/src/practices/usePlanSheetState';

interface Props {
  needId: string;
  needColor: string;
  needLabel: string;
  color: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PlanSheet({ needId, needLabel, color, onClose, onSaved }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const {
    selectedText,
    customText,
    setCustomText,
    reminderIdx,
    setReminderIdx,
    saving,
    saveError,
    setSaveError,
    savedOk,
    phase,
    setPhase,
    deletingIds,
    practicesFailed,
    allOptions,
    selectText,
    handleCustomSubmit,
    handleDeletePractice,
    handleSave,
    handleIcsDownload,
  } = usePlanSheetState(needId, needLabel, api, onSaved);

  return (
    <ExScreen
      onBack={phase === 'confirm' ? () => setPhase('pick') : goBack}
      backLabel={phase === 'confirm' ? '← Выбрать другое' : 'Назад'}
      eyebrow={needLabel}
      eyebrowColor={color}
      title={phase === 'pick'
        ? <>{tr('Что сделаешь', 'Что сделаете')}<br /><span className="it">завтра?</span></>
        : <>Запланировать<br /><span className="it">{selectedText.length > 30 ? selectedText.slice(0, 30) + '…' : selectedText}</span></>
      }
      lede={phase === 'pick' ? 'Один маленький конкретный шаг – уже много.' : undefined}
      aside={
        <div className="ds-card sk-aside" style={hueStyle(NEED_HUE[needId as NeedId])}>
          <div className="ds-label">Потребность</div>
          <h3 className="ds-h3 sk-aside-title">
            <span className="ds-dot tone-fill" /> {needLabel}
          </h3>
          <p className="ds-sub">Практика помогает восстановить потребность через конкретное действие</p>
        </div>
      }
    >
      {phase === 'pick' && (
        <>
          {practicesFailed && (
            <div role="alert" className="sk-error">
              {tr('Не удалось загрузить твои практики — ниже только готовые варианты', 'Не удалось загрузить ваши практики — ниже только готовые варианты')}
            </div>
          )}
          {allOptions.length > 0 && (
            <div className="sk-field">
              <div className="ds-label">Готовые варианты</div>
              <div className="sk-list">
                {allOptions.map(({ text, isUser, id }) => (
                  <div key={text} className="sk-opt-row">
                    <div
                      onClick={() => selectText(text)}
                      role="button" tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectText(text); } }}
                      className={'ds-card ds-card--row ds-card--hover sk-opt' + (isUser ? ' tone-border' : '')}
                      style={hueStyle(NEED_HUE[needId as NeedId])}
                    >
                      {text}
                    </div>
                    {isUser && id !== undefined && (
                      <button
                        onClick={() => handleDeletePractice(id)}
                        disabled={deletingIds.has(id)}
                        className="ds-btn ds-btn--icon sk-del"
                        aria-label="Удалить"
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sk-field">
            <div className="ds-label">{allOptions.length > 0 ? 'Или своё' : tr('Что планируешь?', 'Что планируете?')}</div>
            <textarea
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="Что-то конкретное, маленькое..."
              maxLength={200}
              rows={2}
              className="ds-textarea"
            />{detectCrisisAny(customText) && <CrisisCard surface="plan" />}
            {customText.trim() && (
              <button onClick={handleCustomSubmit} className="ds-btn sk-self-start">
                Продолжить →
              </button>
            )}
          </div>
        </>
      )}

      {phase === 'confirm' && (
        <>
          <div className="sk-field">
            <div className="ds-label">Практика</div>
            <div className="sk-chosen tone-tint" style={hueStyle(NEED_HUE[needId as NeedId])}>
              {selectedText}
            </div>
          </div>

          <div className="sk-field">
            <div className="ds-label">Напомнить завтра</div>
            <div className="sk-list">
              {REMINDER_OPTIONS.map((opt, i) => (
                <div
                  key={i}
                  onClick={() => setReminderIdx(i)}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReminderIdx(i); } }}
                  className={'ds-card ds-card--row ds-card--hover sk-opt' + (reminderIdx === i ? ' tone-border is-selected' : '')}
                  style={hueStyle(NEED_HUE[needId as NeedId])}
                >
                  <span>
                    {opt.label}
                    {opt.localHour !== null && <span className="ds-sub sk-hour">{String(opt.localHour).padStart(2, '0')}:00</span>}
                  </span>
                  {reminderIdx === i && <span className="sk-check"><GlyphCheck /></span>}
                </div>
              ))}
            </div>
          </div>

          {/* ICS download — паритет с мини-аппом, правило №16 */}
          <button onClick={handleIcsDownload} className="ds-btn ds-btn--secondary sk-ics">
            Добавить в календарь (.ics)
          </button>

          {saveError && (
            <div className="sk-error sk-center">
              {tr('Не удалось сохранить. Попробуй ещё раз.', 'Не удалось сохранить. Попробуйте ещё раз.')}
            </div>
          )}

          <div className="sk-foot">
            <button
              onClick={() => { setSaveError(false); handleSave(); }}
              disabled={saving || savedOk}
              className={'ds-btn ' + (savedOk ? 'ds-btn--secondary' : 'ds-btn--accent')}
            >
              {savedOk ? <><GlyphCheck /> Запланировано</> : saving ? '…' : 'Сохранить план'}
            </button>
          </div>
        </>
      )}
    </ExScreen>
  );
}
