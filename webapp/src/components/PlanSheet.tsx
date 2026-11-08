import { api } from '../api';
import { ExScreen } from './exercises/ExScreen';
import { Check } from './art/PaperArtSigns';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { NEED_HUE, hueStyle } from '../lib/tone';
import type { NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tasks.css';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { usePlanSheetState } from '../../../shared/src/practices/usePlanSheetState';
import { PlanConfirm } from './plans/PlanConfirm';

interface Props {
  needId: string;
  needLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PlanSheet({ needId, needLabel, onClose, onSaved }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const state = usePlanSheetState(needId, needLabel, api, () => goBack(onSaved)); // лист снимает свою запись истории сам
  const {
    selectedText, customText, setCustomText, phase, setPhase, deletingIds,
    practicesFailed, allOptions, selectText, handleCustomSubmit, handleDeletePractice,
  } = state;

  return (
    <ExScreen
      onBack={phase === 'confirm' ? () => setPhase('pick') : goBack}
      backLabel={phase === 'confirm' ? '← Выбрать другое' : 'Назад'}
      eyebrow={needLabel}
      title={phase === 'pick'
        ? <>{tr('Что сделаешь', 'Что сделаете')}<br /><span className="it">завтра?</span></>
        : <>Запланировать<br /><span className="it">{selectedText.length > 30 ? selectedText.slice(0, 30) + '…' : selectedText}</span></>
      }
      lede={phase === 'pick' ? 'Один маленький конкретный шаг – уже много.' : undefined}
      aside={
        <div className="ds-card sk-aside" style={hueStyle(NEED_HUE[needId as NeedId])}>
          <Check size="row" />
          <div className="ds-label">Потребность</div>
          <h3 className="ds-h3 sk-aside-title">
            <span className="ds-dot tone-fill" /> {needLabel}
          </h3>
          <p className="ds-sub">Потребность восстанавливается через маленькое конкретное действие</p>
        </div>
      }
    >
      {phase === 'pick' && (
        <>
          {practicesFailed && (
            <div role="alert" className="sk-error">
              {tr('Не удалось загрузить твой список «Что меня питает» — ниже только готовые варианты', 'Не удалось загрузить ваш список «Что меня питает» — ниже только готовые варианты')}
            </div>
          )}
          {allOptions.length > 0 && (
            <div className="sk-field">
              <div className="ds-label">Что питает</div>
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

      {phase === 'confirm' && <PlanConfirm s={state} needId={needId} needLabel={needLabel} />}
    </ExScreen>
  );
}
