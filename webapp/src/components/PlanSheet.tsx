/* eslint-disable react-refresh/only-export-components -- файл намеренно держит компонент рядом с его константами/хуками; вынос в отдельный файл — churn ради dev-only Fast Refresh, на прод-рантайм не влияет */
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { UserPractice } from '../api';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';

function ianaToUtcOffset(iana: string): number {
  try {
    const now = new Date();
    const utcMs = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
    const localMs = new Date(now.toLocaleString('en-US', { timeZone: iana })).getTime();
    return Math.round((localMs - utcMs) / 3600000);
  } catch { return 3; }
}

export const CURATED: Record<string, string[]> = {
  attachment: [
    'Написать кому-то близкому без повода',
    'Провести вечер вместе – без телефонов',
    'Спросить кого-то «Как ты на самом деле?»',
    'Поделиться чем-то личным в разговоре',
  ],
  autonomy: [
    'Принять одно решение самостоятельно, без совета',
    'Сделать что-то только потому что я хочу',
    'Выделить час на своё дело без объяснений',
    'Сказать «нет» одной просьбе, если не хочу',
  ],
  expression: [
    'Написать про момент дня, когда что-то было внутри – и осталось невысказанным',
    'Назвать вслух одну свою эмоцию',
    'Рассказать кому-то о чём-то, что меня трогает',
    'Выразить несогласие мягко, но честно',
  ],
  play: [
    'Сделать что-то без цели – просто потому что весело',
    'Попробовать новое место или маршрут',
    'Поиграть во что-нибудь – хоть в игру на телефоне',
    'Сделать что-то руками – приготовить, нарисовать, смастерить',
  ],
  limits: [
    'Закончить работу вовремя, не задерживаться',
    'Выполнить одно дело, которое откладывал',
    'Отказаться от одного лишнего обязательства',
    'Соблюдать одно правило для себя весь день',
  ],
};

const REMINDER_OPTIONS = [
  { label: 'Утром', localHour: 9 },
  { label: 'Днём', localHour: 13 },
  { label: 'Вечером', localHour: 19 },
  { label: 'Без напоминания', localHour: null },
];

interface Props {
  needId: string;
  needEmoji: string;
  needLabel: string;
  color: string;
  onClose: () => void;
  onSaved: () => void;
}

function defaultReminderIdx(): number {
  const h = new Date().getHours();
  if (h < 12) return 0;
  if (h < 17) return 1;
  return 2;
}

export function PlanSheet({ needId, needEmoji, needLabel, color, onClose, onSaved }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [userPractices, setUserPractices] = useState<UserPractice[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [customText, setCustomText] = useState('');
  const [reminderIdx, setReminderIdx] = useState(defaultReminderIdx);
  const [tzOffset, setTzOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [phase, setPhase] = useState<'pick' | 'confirm'>('pick');
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.getPractices(needId).then(setUserPractices).catch(() => {});
    api.getSettings().then(s => setTzOffset(ianaToUtcOffset(s.notifyTimezone))).catch(() => {});
  }, [needId]);

  const curated = CURATED[needId] ?? [];
  const allOptions = [
    ...userPractices.map(p => ({ text: p.text, isUser: true, id: p.id })),
    ...curated.filter(t => !userPractices.some(p => p.text === t)).map(t => ({ text: t, isUser: false, id: undefined as number | undefined })),
  ];

  function selectText(text: string) { setSelectedText(text); setCustomText(''); setPhase('confirm'); }
  function handleCustomSubmit() { const t = customText.trim(); if (!t) return; setSelectedText(t); setPhase('confirm'); }

  async function handleSave() {
    if (!selectedText || saving) return;
    setSaving(true);
    try {
      const opt = REMINDER_OPTIONS[reminderIdx];
      let reminderUtcHour: number | undefined;
      if (opt.localHour !== null) reminderUtcHour = ((opt.localHour - tzOffset) % 24 + 24) % 24;
      if (!userPractices.some(p => p.text === selectedText)) await api.addPractice(needId, selectedText);
      await api.createPlan(needId, selectedText, reminderUtcHour);
      setSavedOk(true);
      setTimeout(() => onSaved(), 1200);
    } catch { setSaveError(true); } finally { setSaving(false); }
  }

  return (
    <ExScreen
      onBack={phase === 'confirm' ? () => setPhase('pick') : goBack}
      backLabel={phase === 'confirm' ? '← Выбрать другое' : 'Назад'}
      eyebrow={`${needEmoji} ${needLabel}`}
      eyebrowColor={color}
      title={phase === 'pick'
        ? <>Что сделаешь<br /><span className="it">завтра?</span></>
        : <>Запланировать<br /><span className="it">{selectedText.length > 30 ? selectedText.slice(0, 30) + '…' : selectedText}</span></>
      }
      lede={phase === 'pick' ? 'Один маленький конкретный шаг – уже много.' : undefined}
      aside={
        <div className="aside-card" style={{ borderColor: `${color}40`, background: `${color}08`, position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow" style={{ color }}>Потребность</div>
          <h3 style={{ fontSize: 18 }}>{needEmoji} {needLabel}</h3>
          <p className="body">Практика помогает восстановить потребность через конкретное действие</p>
        </div>
      }
    >
      {phase === 'pick' && (
        <>
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
                          onClick={() => {
                            if (deletingIds.has(id)) return;
                            setDeletingIds(prev => new Set([...prev, id]));
                            api.deletePractice(id)
                              .then(() => setUserPractices(prev => prev.filter(p => p.id !== id)))
                              .catch(() => setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s; }));
                          }}
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
              />
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
