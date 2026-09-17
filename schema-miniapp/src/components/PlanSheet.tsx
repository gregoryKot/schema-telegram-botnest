import { api } from '../api';
import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
import { useTr } from '../utils/addressForm';
import { PracticeOptionRow } from './planSheet/PracticeOptionRow';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { LoadErrorBanner } from './LoadErrorBanner';
import {
  usePlanSheetState,
  REMINDER_OPTIONS,
} from '../../../shared/src/practices/usePlanSheetState';

interface Props {
  needId: string;
  needLabel: string;
  color: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PlanSheet({
  needId,
  needLabel,
  color,
  onClose,
  onSaved,
}: Props) {
  const tr = useTr();
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
    <BottomSheet onClose={onClose}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            background: color + '26',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IdentityDot id={needId} size={14} />
        </div>
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.2,
            }}
          >
            {tr('Что сделаешь завтра?', 'Что сделаете завтра?')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>
            {needLabel}
          </div>
        </div>
      </div>

      {phase === 'pick' && (
        <>
          {practicesFailed && (
            <div style={{ marginBottom: 16 }}>
              <LoadErrorBanner
                message={tr(
                  'Не удалось загрузить твои практики — ниже только готовые варианты',
                  'Не удалось загрузить ваши практики — ниже только готовые варианты',
                )}
              />
            </div>
          )}
          {allOptions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>Мои практики</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allOptions.map(({ text, isUser, id }) => (
                  <PracticeOptionRow
                    key={text}
                    text={text}
                    isUser={isUser}
                    id={id}
                    color={color}
                    onSelect={() => selectText(text)}
                    deleting={id !== undefined && deletingIds.has(id)}
                    onDelete={() =>
                      id !== undefined && handleDeletePractice(id)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <SectionLabel>
              {allOptions.length > 0
                ? 'Или своя'
                : tr('Что планируешь сделать?', 'Что планируете сделать?')}
            </SectionLabel>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Что-то конкретное, маленькое..."
              maxLength={200}
              rows={2}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(var(--fg-rgb),0.05)',
                border: '1px solid rgba(var(--fg-rgb),0.1)',
                borderRadius: 12,
                padding: '12px 14px',
                color: 'var(--text)',
                fontSize: 15,
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            {/* правило №7: свободный текст обязан проходить кризисную детекцию */}
            {detectCrisisAny(customText) && <CrisisCard surface="plan" />}
          </div>
          {customText.trim() && (
            <button onClick={handleCustomSubmit} className="btn-primary">
              Продолжить →
            </button>
          )}
        </>
      )}

      {phase === 'confirm' && (
        <>
          {/* Selected practice */}
          <div
            style={{
              background: color + '18',
              border: `1px solid ${color}33`,
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color,
                fontWeight: 500,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Практика
            </div>
            <div
              style={{
                fontSize: 15,
                color: 'rgba(var(--fg-rgb),0.9)',
                lineHeight: 1.5,
              }}
            >
              {selectedText}
            </div>
          </div>

          {/* Reminder time */}
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>Напомнить завтра</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REMINDER_OPTIONS.map((opt, i) => (
                <div
                  key={i}
                  onClick={() => setReminderIdx(i)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setReminderIdx(i);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background:
                      reminderIdx === i
                        ? color + '22'
                        : 'rgba(var(--fg-rgb),0.04)',
                    border: `1px solid ${reminderIdx === i ? color + '44' : 'transparent'}`,
                    borderRadius: 12,
                    padding: '11px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      flexShrink: 0,
                      border: `2px solid ${reminderIdx === i ? color : 'rgba(var(--fg-rgb),0.2)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {reminderIdx === i && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: color,
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 15,
                      color:
                        reminderIdx === i
                          ? 'var(--text)'
                          : 'rgba(var(--fg-rgb),0.6)',
                    }}
                  >
                    {opt.label}
                    {opt.localHour !== null && (
                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--text-sub)',
                          marginLeft: 6,
                        }}
                      >
                        {String(opt.localHour).padStart(2, '0')}:00
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ICS download */}
          <div style={{ marginBottom: 16 }}>
            <div
              onClick={handleIcsDownload}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleIcsDownload();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(var(--fg-rgb),0.04)',
                border: '1px solid rgba(var(--fg-rgb),0.08)',
                borderRadius: 12,
                padding: '10px 14px',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                Добавить в календарь (.ics)
              </span>
            </div>
          </div>

          {saveError && (
            <div
              style={{
                fontSize: 13,
                color: '#ff6b6b',
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              {tr(
                'Не удалось сохранить. Попробуй ещё раз.',
                'Не удалось сохранить. Попробуйте ещё раз.',
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setPhase('pick')}
              style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: 14,
                border: '1px solid rgba(var(--fg-rgb),0.1)',
                background: 'transparent',
                color: 'var(--text-sub)',
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              ← Назад
            </button>
            <button
              onClick={() => {
                setSaveError(false);
                void handleSave();
              }}
              disabled={saving || savedOk}
              style={{
                flex: 2,
                padding: '14px 0',
                borderRadius: 14,
                border: 'none',
                background: savedOk
                  ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                  : saving
                    ? 'rgba(var(--fg-rgb),0.1)'
                    : color,
                color: savedOk ? 'var(--accent-green)' : '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: saving || savedOk ? 'default' : 'pointer',
                transition: 'all 0.3s',
              }}
            >
              {savedOk ? '✓ Запланировано' : saving ? '...' : 'Сохранить план'}
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
