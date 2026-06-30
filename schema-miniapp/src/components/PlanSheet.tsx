import { useEffect, useState } from 'react';
import { api, UserPractice } from '../api';
import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';

function ianaToUtcOffset(iana: string): number {
  try {
    const now = new Date();
    const utcMs = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
    const localMs = new Date(now.toLocaleString('en-US', { timeZone: iana })).getTime();
    return Math.round((localMs - utcMs) / 3600000);
  } catch {
    return 3;
  }
}

export const CURATED: Record<string, string[]> = {
  attachment: [
    'Написать кому-то близкому без повода',
    'Провести вечер вместе — без телефонов',
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
    'Написать про момент дня, когда что-то было внутри — и осталось невысказанным',
    'Назвать вслух одну свою эмоцию',
    'Рассказать кому-то о чём-то, что меня трогает',
    'Выразить несогласие мягко, но честно',
  ],
  play: [
    'Сделать что-то без цели — просто потому что весело',
    'Попробовать новое место или маршрут',
    'Поиграть во что-нибудь — хоть в игру на телефоне',
    'Сделать что-то руками — приготовить, нарисовать, смастерить',
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
  if (h < 12) return 0; // Утром
  if (h < 17) return 1; // Днём
  return 2;             // Вечером
}

export function PlanSheet({ needId, needEmoji, needLabel, color, onClose, onSaved }: Props) {
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
    ...curated
      .filter(t => !userPractices.some(p => p.text === t))
      .map(t => ({ text: t, isUser: false, id: undefined as number | undefined })),
  ];

  function selectText(text: string) {
    setSelectedText(text);
    setCustomText('');
    setPhase('confirm');
  }

  function handleCustomSubmit() {
    const t = customText.trim();
    if (!t) return;
    setSelectedText(t);
    setPhase('confirm');
  }

  async function handleSave() {
    if (!selectedText || saving) return;
    setSaving(true);
    try {
      const opt = REMINDER_OPTIONS[reminderIdx];
      let reminderUtcHour: number | undefined;
      if (opt.localHour !== null) {
        reminderUtcHour = ((opt.localHour - tzOffset) % 24 + 24) % 24;
      }
      if (!userPractices.some(p => p.text === selectedText)) {
        await api.addPractice(needId, selectedText);
      }
      await api.createPlan(needId, selectedText, reminderUtcHour);
      setSavedOk(true);
      setTimeout(() => onSaved(), 1200);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: color + '26',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {needEmoji}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
            Что сделаешь завтра?
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>
            {needLabel}
          </div>
        </div>
      </div>

      {phase === 'pick' && (
        <>
          {allOptions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>Твои практики</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allOptions.map(({ text, isUser, id }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      onClick={() => selectText(text)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                        background: 'rgba(var(--fg-rgb),0.05)',
                        border: '1px solid rgba(var(--fg-rgb),0.08)',
                        borderRadius: 12, padding: '11px 14px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: isUser ? color : 'rgba(var(--fg-rgb),0.2)',
                      }} />
                      <div style={{ fontSize: 14, color: 'rgba(var(--fg-rgb),0.85)', flex: 1, lineHeight: 1.45 }}>
                        {text}
                      </div>
                      <div style={{ fontSize: 18, color: 'var(--text-faint)', flexShrink: 0 }}>›</div>
                    </div>
                    {isUser && id !== undefined && (
                      <div
                        onClick={() => {
                          if (deletingIds.has(id)) return;
                          setDeletingIds(prev => new Set([...prev, id]));
                          api.deletePractice(id)
                            .then(() => setUserPractices(prev => prev.filter(p => p.id !== id)))
                            .catch(() => setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s; }));
                        }}
                        style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: 'rgba(255,100,100,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: deletingIds.has(id) ? 'default' : 'pointer',
                          fontSize: 16, color: deletingIds.has(id) ? 'rgba(255,100,100,0.2)' : 'rgba(255,100,100,0.5)',
                        }}
                      >×</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <SectionLabel>{allOptions.length > 0 ? 'Или своя' : 'Что планируешь сделать?'}</SectionLabel>
            <textarea
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="Что-то конкретное, маленькое..."
              maxLength={200}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(var(--fg-rgb),0.05)',
                border: '1px solid rgba(var(--fg-rgb),0.1)',
                borderRadius: 12, padding: '12px 14px',
                color: 'var(--text)', fontSize: 15, lineHeight: 1.5,
                resize: 'none', outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
          {customText.trim() && (
            <button
              onClick={handleCustomSubmit}
              className="btn-primary"
            >
              Продолжить →
            </button>
          )}
        </>
      )}

      {phase === 'confirm' && (
        <>
          {/* Selected practice */}
          <div style={{
            background: color + '18',
            border: `1px solid ${color}33`,
            borderRadius: 14, padding: '14px 16px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 12, color, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Практика
            </div>
            <div style={{ fontSize: 15, color: 'rgba(var(--fg-rgb),0.9)', lineHeight: 1.5 }}>
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
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: reminderIdx === i ? color + '22' : 'rgba(var(--fg-rgb),0.04)',
                    border: `1px solid ${reminderIdx === i ? color + '44' : 'transparent'}`,
                    borderRadius: 12, padding: '11px 14px', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${reminderIdx === i ? color : 'rgba(var(--fg-rgb),0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {reminderIdx === i && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    )}
                  </div>
                  <span style={{ fontSize: 15, color: reminderIdx === i ? 'var(--text)' : 'rgba(var(--fg-rgb),0.6)' }}>
                    {opt.label}
                    {opt.localHour !== null && (
                      <span style={{ fontSize: 13, color: 'var(--text-sub)', marginLeft: 6 }}>
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
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() + 1);
                const y = date.getUTCFullYear();
                const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
                const d = String(date.getUTCDate()).padStart(2, '0');
                const opt = REMINDER_OPTIONS[reminderIdx];
                const h = opt.localHour !== null ? String(((opt.localHour - tzOffset + 24) % 24)).padStart(2, '0') : '09';
                const ics = [
                  'BEGIN:VCALENDAR',
                  'VERSION:2.0',
                  'PRODID:-//Schema//Schema//RU',
                  'BEGIN:VEVENT',
                  `DTSTART:${y}${mo}${d}T${h}0000Z`,
                  `DTEND:${y}${mo}${d}T${h}3000Z`,
                  `SUMMARY:🎯 ${selectedText}`,
                  `DESCRIPTION:Практика для потребности: ${needLabel}`,
                  'END:VEVENT',
                  'END:VCALENDAR',
                ].join('\r\n');
                const dataUrl = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
                // Telegram WebApp: use openLink to let the OS handle .ics
                if (window.Telegram?.WebApp?.openLink) {
                  window.Telegram.WebApp.openLink(dataUrl);
                } else {
                  const a = document.createElement('a');
                  a.href = dataUrl;
                  a.download = 'practice.ics';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(var(--fg-rgb),0.04)',
                border: '1px solid rgba(var(--fg-rgb),0.08)',
                borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 16 }}>📅</span>
              <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>Добавить в календарь (.ics)</span>
            </div>
          </div>

          {saveError && (
            <div style={{ fontSize: 13, color: '#ff6b6b', textAlign: 'center', marginBottom: 12 }}>
              Не удалось сохранить. Попробуй ещё раз.
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setPhase('pick')}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: '1px solid rgba(var(--fg-rgb),0.1)',
                background: 'transparent', color: 'var(--text-sub)', fontSize: 15, cursor: 'pointer',
              }}
            >
              ← Назад
            </button>
            <button
              onClick={() => { setSaveError(false); handleSave(); }}
              disabled={saving || savedOk}
              style={{
                flex: 2, padding: '14px 0', borderRadius: 14, border: 'none',
                background: savedOk ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : saving ? 'rgba(var(--fg-rgb),0.1)' : color,
                color: savedOk ? 'var(--accent-green)' : '#fff', fontSize: 15, fontWeight: 600, cursor: (saving || savedOk) ? 'default' : 'pointer',
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
