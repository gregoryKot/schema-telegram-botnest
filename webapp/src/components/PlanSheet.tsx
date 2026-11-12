import { useRef } from 'react';
import { api } from '../api';
import { ExScreen, GlyphX } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { NEED_HUE, hueStyle } from '../lib/tone';
import { needLook } from '../../../shared/src/theme/entityLook';
import type { NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tasks.css';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { usePlanSheetState } from '../../../shared/src/practices/usePlanSheetState';
import { PlanConfirm } from './plans/PlanConfirm';
import { PlanDone } from './plans/PlanDone';
import { PaperAlert } from './paper/PaperAlert';
import { SignArt } from './art/SignArt';
import { glue, glueSpaces } from '../../../shared/src/utils/typo';

interface Props {
  needId: string;
  needLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

// Лист плана (b20): разворотом — слева лист потребности (NEED_HUE + NeedArt вместо белой карточки с Check и точкой),
// справа выбор: свои действия — на бумаге потребности со знаком Leaf (красная рамка читалась ошибкой), готовые — белые
// строки. Второй шаг — PlanConfirm, «Запланировано» — PlanDone (лист «готово»).
export function PlanSheet({ needId, needLabel, onClose, onSaved }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  // Закрыть один раз: «Готово» на листе «Запланировано» и таймер сохранения (1,2 с) не снимают историю дважды.
  const closed = useRef(false);
  const finish = () => { if (closed.current) return; closed.current = true; goBack(onSaved); };
  const state = usePlanSheetState(needId, needLabel, api, finish); // лист снимает свою запись истории сам
  const {
    selectedText, customText, setCustomText, phase, setPhase, deletingIds,
    practicesFailed, allOptions, selectText, handleCustomSubmit, handleDeletePractice,
  } = state;
  const look = needLook(needId as NeedId);
  const pick = phase === 'pick';
  // Пояснение листа плана (до b20 — подпись белой карточки «Потребность») — подписью листа-героя, вторая фраза абзацем (ревью g6).
  const pickLede = <>{glue('Потребность восстанавливается через маленькое конкретное действие')}<span className="sk-lede-next">{glue('Один маленький конкретный шаг – уже много.')}</span></>;

  return (
    <ExScreen
      onBack={pick ? goBack : () => setPhase('pick')}
      backLabel={pick ? 'Назад' : 'Выбрать другое'}
      eyebrow={needLabel}
      look={look}
      compact={!pick}
      spread
      title={pick
        ? tr('Что сделаешь завтра?', 'Что сделаете завтра?')
        : <>Запланировать<br /><span className="sk-title-step">{selectedText.length > 30 ? selectedText.slice(0, 30) + '…' : selectedText}</span></>
      }
      lede={pick ? pickLede : undefined}
    >
      {pick && (
        <div className="sk-plan-pick">
          {practicesFailed && (
            <PaperAlert title={tr('Не удалось загрузить твой список «Что меня питает» — ниже только готовые варианты', 'Не удалось загрузить ваш список «Что меня питает» — ниже только готовые варианты')} sign="leaf" />
          )}
          {allOptions.length > 0 && (
            <div className="sk-field">
              <div className="ds-label">Что питает</div>
              <div className="sk-list">
                {allOptions.map(({ text, isUser, id }) => (
                  <div key={text} className="sk-opt-row">
                    <button type="button" onClick={() => selectText(text)}
                      className={'ds-card ds-card--row ds-card--hover sk-opt' + (isUser ? ' pp-paper is-mine' : '')}
                      style={isUser ? hueStyle(NEED_HUE[needId as NeedId]) : undefined}>
                      {isUser && <span className="pp-row-art" aria-hidden="true"><SignArt sign="leaf" size="row" /></span>}
                      <span className="sk-opt-text">{glueSpaces(text)}</span>
                      <span className="ds-chev" aria-hidden="true" />
                    </button>
                    {isUser && id !== undefined && (
                      <button onClick={() => handleDeletePractice(id)} disabled={deletingIds.has(id)}
                        className="sk-del" aria-label="Удалить" title="Удалить"><GlyphX /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sk-field sk-field--own">
            <div className="ds-label">{allOptions.length > 0 ? 'Или своё' : tr('Что планируешь?', 'Что планируете?')}</div>
            <textarea
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="Что-то конкретное, маленькое..."
              maxLength={200}
              rows={2}
              className="ds-textarea"
            />{detectCrisisAny(customText) && <CrisisCard surface="plan" />}
            {customText.trim() && <button onClick={handleCustomSubmit} className="ds-btn sk-self-start">Продолжить →</button>}
          </div>
        </div>
      )}

      {phase === 'confirm' && (state.savedOk
        ? <PlanDone s={state} needLabel={needLabel} onDone={finish} />
        : <PlanConfirm s={state} needId={needId} needLabel={needLabel} />)}
    </ExScreen>
  );
}
