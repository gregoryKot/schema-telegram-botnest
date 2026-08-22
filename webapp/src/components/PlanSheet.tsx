import { api } from '../api';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
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

export function PlanSheet({ needId, needColor, needLabel, color, onClose, onSaved }: Props) {
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
        ? <>Что сделаешь<br /><span className="it">завтра?</span></>
        : <>Запланировать<br /><span className="it">{selectedText.length > 30 ? selectedText.slice(0, 30) + '…' : selectedText}</span></>
      }
      lede={phase === 'pick' ? 'Один маленький конкретный шаг – уже много.' : undefined}
      aside={
        <div className="aside-card" style={{ borderColor: `${color}40`, background: `${color}08`, position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow" style={{ color }}>Потребность</div>
          <h3 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><IdentityDot color={needColor} /> {needLabel}</h3>
          <p className="body">Практика помогает восстановить потребность через конкретное действие</p>
        </div>
      }
    >
      {phase === 'pick' && (
        <>
          {practicesFailed && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--c-rose)', marginBottom: 12 }}>
              {tr('Не удалось загрузить твои практики — ниже только готовые варианты', 'Не удалось загрузить ваши практики — ниже только готовые варианты')}
            </div>
          )}
          {allOptions.length > 0 && (
            <div className="prompt">
              <div className="prompt-num">·</div>
              <div style={{ width: '100%' }}>
                <div className="prompt-label">Готовые варианты</div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {allOptions.map(({ text, isUser, id }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        onClick={() => selectText(text)}
                        role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectText(text); } }}
                        className="mode-card"
                        style={{ '--mode-color': isUser ? color : 'var(--text-ghost)', flex: 1 } as React.CSSProperties}
                      >
                        <span className="mode-card-stripe" />
                        <div className="mode-card-name">{text}</div>
                      </div>
                      {isUser && id !== undefined && (
                        <button
                          onClick={() => handleDeletePractice(id)}
                          style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'color-mix(in srgb, var(--c-rose) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: deletingIds.has(id) ? 'default' : 'pointer', fontSize: 16, color: deletingIds.has(id) ? 'var(--text-ghost)' : 'var(--c-rose)', border: 'none' }}
                          aria-label="Удалить"
                        >×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="prompt">
            <div className="prompt-num">·</div>
            <div style={{ width: '100%' }}>
              <div className="prompt-label">{allOptions.length > 0 ? 'Или своё' : tr('Что планируешь?', 'Что планируете?')}</div>
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder="Что-то конкретное, маленькое..."
                maxLength={200}
                rows={2}
                className={'paper-input ' + (customText.trim() ? 'is-filled' : '')}
              />{detectCrisisAny(customText) && <CrisisCard surface="plan" />}
              {customText.trim() && (
                <button onClick={handleCustomSubmit} className="ex-btn ex-btn-primary" style={{ marginTop: 8 }}>
                  Продолжить →
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {phase === 'confirm' && (
        <>
          {/* Selected practice */}
          <div className="prompt">
            <div className="prompt-num">·</div>
            <div style={{ width: '100%' }}>
              <div className="prompt-label">Практика</div>
              <div style={{ marginTop: 8, padding: '14px 16px', borderRadius: 12, background: `${color}18`, border: `1px solid ${color}33`, fontSize: 15, color: 'var(--text)', lineHeight: 1.5 }}>
                {selectedText}
              </div>
            </div>
          </div>

          {/* Reminder */}
          <div className="prompt">
            <div className="prompt-num">·</div>
            <div style={{ width: '100%' }}>
              <div className="prompt-label">Напомнить завтра</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {REMINDER_OPTIONS.map((opt, i) => (
                  <div
                    key={i}
                    onClick={() => setReminderIdx(i)}
                    role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReminderIdx(i); } }}
                    className={'mode-card ' + (reminderIdx === i ? 'is-selected' : '')}
                    style={{ '--mode-color': color } as React.CSSProperties}
                  >
                    <span className="mode-card-stripe" />
                    <div>
                      <div className="mode-card-name">
                        {opt.label}
                        {opt.localHour !== null && <span style={{ fontSize: 13, color: 'var(--text-faint)', marginLeft: 8 }}>{String(opt.localHour).padStart(2, '0')}:00</span>}
                      </div>
                    </div>
                    {reminderIdx === i && <span className="mode-check"><GlyphCheck /></span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ICS download — паритет с мини-аппом, правило №16 */}
          <button
            onClick={handleIcsDownload}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>Добавить в календарь (.ics)</span>
          </button>

          {saveError && (
            <div style={{ fontSize: 13, color: 'var(--c-rose)', textAlign: 'center', marginBottom: 12 }}>
              {tr('Не удалось сохранить. Попробуй ещё раз.', 'Не удалось сохранить. Попробуйте ещё раз.')}
            </div>
          )}

          <div className="ex-foot">
            <span className="spacer" />
            <button
              onClick={() => { setSaveError(false); handleSave(); }}
              disabled={saving || savedOk}
              className="ex-btn ex-btn-primary"
              style={{ background: savedOk ? 'color-mix(in srgb, var(--c-moss) 20%, transparent)' : color, color: savedOk ? 'var(--c-moss)' : '#fff', transition: 'all 0.3s' }}
            >
              {savedOk ? <><GlyphCheck /> Запланировано</> : saving ? '…' : 'Сохранить план'}
            </button>
          </div>
        </>
      )}
    </ExScreen>
  );
}
