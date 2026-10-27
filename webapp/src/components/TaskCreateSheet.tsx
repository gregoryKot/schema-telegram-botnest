import { useState, useRef, useEffect } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { api, type UserId } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { haptic } from '../haptic';
import { pressable } from '../utils/a11y';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { useTr } from '../utils/addressForm';
import { hueStyle } from '../lib/tone';
import { TASK_OPTIONS, STREAK_OPTIONS, type TaskType } from './taskCreate/taskOptions';
import { SchemaPicker, ModePicker } from './taskCreate/TaskPickers';
import { LimitedTextarea } from '../../../shared/src/components/LimitedTextarea';
import { TASK_TEXT_MAX } from '../../../shared/src/limits/textLimits';
import { taskPayloadText } from '../../../shared/src/tasks/taskPayload';
import { assignLead, assignableOptions } from '../../../shared/src/tasks/assignCopy';
import '../styles/sheet-tasks.css';

interface Props {
  clientId?: UserId; clientName?: string;
  /** Тип и текст, с которыми лист открывается (шаблоны «Назначить из шаблона»). */
  defaultType?: TaskType; defaultText?: string;
  onCreated: () => void; onClose: () => void;
}

export function TaskCreateSheet({ clientId, clientName, defaultType, defaultText, onCreated, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const tr = useTr();
  // Офлайн-клиенту — только «Своё задание» (shared/tasks/assignCopy).
  const options = assignableOptions(TASK_OPTIONS, clientId);
  const [type, setType] = useState<TaskType>(() =>
    options.find(o => o.type === (defaultType ?? 'tracker_streak'))?.type ?? options[0].type);
  const [targetDays, setTargetDays] = useState(7);
  const [text, setText] = useState(defaultText ?? '');
  const [selectedSchemaId, setSelectedSchemaId] = useState('');
  const [selectedModeId, setSelectedModeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const configRef = useRef<HTMLDivElement>(null);
  const customTextRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if ((type === 'schema_intro' || type === 'mode_intro') && configRef.current) {
      setTimeout(() => scrollIntoViewSafe(configRef.current, { block: 'nearest' }), 80);
    }
  }, [type]);

  useEffect(() => {
    const el = customTextRef.current;
    if (type !== 'custom' || !el) return;
    el.focus();
    // Шаблон с текстом: курсор в конец, дописать режим или детали.
    el.setSelectionRange(el.value.length, el.value.length);
  }, [type]);

  const selected = options.find(o => o.type === type) ?? options[0];
  const lead = assignLead(clientId);

  async function handleCreate() {
    const finalText = taskPayloadText({ type, targetDays, schemaId: selectedSchemaId, modeId: selectedModeId, text }).trim();
    if (type === 'custom' && !finalText) { setError(tr('Введи описание задания', 'Введите описание задания')); return; }
    if (type === 'schema_intro' && !selectedSchemaId) { setError(tr('Выбери схему', 'Выберите схему')); return; }
    if (type === 'mode_intro' && !selectedModeId) { setError(tr('Выбери режим', 'Выберите режим')); return; }
    haptic.success();
    setSaving(true); setError('');
    try {
      await api.createTask({ type, text: finalText, targetDays: selected.hasStreak ? targetDays : undefined, dueDate: dueDate || undefined, clientId });
      onCreated();
      // Лист закрывается через историю: иначе его запись оставалась, и первое
      // «Назад» браузера после назначения ничего не делало (QA 2026-10-26).
      goBack();
    } catch { haptic.error(); setError('Не удалось сохранить'); }
    finally { setSaving(false); }
  }

  const canSave = type !== 'custom' || text.trim().length > 0;

  return (
    <div className="sk-sheet">
      <div className="sk-top">
        <button className="ds-link sk-back" onClick={goBack}>
          <GlyphArrowLeft /> {clientId !== undefined ? 'Назад к кабинету' : 'Назад'}
        </button>
      </div>

      <div className="sk-scroll">
        <div className="sk-page">
          <div>
            <div className="ds-eyebrow">
              {clientName ? `Задание для ${clientName}` : 'Новое задание'}
            </div>
            <h1 className="ds-h2 sk-title">{tr('Выбери', 'Выберите')}<br /><em className="sk-it">задание</em></h1>
            {lead && <p className="ds-sub sk-lead">{lead}</p>}
          </div>

          <div className="sk-grid">
            {options.map(opt => {
              const isSelected = type === opt.type;
              return (
                <div
                  key={opt.type}
                  className={'sk-tpl tone-tint' + (isSelected ? ' is-selected tone-border' : '')}
                  style={hueStyle(opt.hue)}
                  aria-pressed={isSelected}
                  {...pressable(() => { haptic.select(); setType(opt.type); })}
                >
                  <div className="sk-tpl-body">
                    <div className="sk-tpl-label">{opt.label}</div>
                    <div className="sk-tpl-sub">{opt.sub}</div>
                  </div>
                  <div className="sk-tpl-side">
                    <span className="sk-tpl-time">{opt.time}</span>
                    <span className={'sk-radio' + (isSelected ? ' is-on' : '')} aria-hidden="true">
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div ref={configRef} className="sk-config">
            {selected.hasStreak && (
              <div className="sk-field">
                <div className="ds-label">Цель в днях</div>
                <div className="ds-seg">
                  {STREAK_OPTIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setTargetDays(d)}
                      className={'ds-seg-btn' + (targetDays === d ? ' is-active' : '')}
                    >{d} дн</button>
                  ))}
                </div>
              </div>
            )}

            {type === 'schema_intro' && <SchemaPicker value={selectedSchemaId} onPick={setSelectedSchemaId} />}
            {type === 'mode_intro' && <ModePicker value={selectedModeId} onPick={setSelectedModeId} />}

            {type === 'custom' && (
              <div className="sk-field">
                <div className="ds-label">Описание задания</div>
                <LimitedTextarea
                  ref={customTextRef}
                  max={TASK_TEXT_MAX}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Например: позвонить другу раз в неделю"
                  className="ds-textarea"
                  rows={3}
                />
                {/* правило №7: свободный текст обязан проходить кризисную детекцию */}
                {detectCrisisAny(text) && <CrisisCard surface="task" />}
              </div>
            )}

            {(type === 'custom' || clientId) && (
              <div className="sk-field">
                <div className="ds-label">Срок (необязательно)</div>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="ds-input" />
              </div>
            )}
          </div>

          <div className="sk-submit">
            {error ? <span className="sk-error">{error}</span> : <span />}
            <button className="ds-btn" onClick={handleCreate} disabled={!canSave || saving}>
              {saving ? 'Назначаю…' : 'Назначить задание'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
