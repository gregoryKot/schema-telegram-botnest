import { useState, useRef, useEffect } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { EntitySheet } from './paper/EntitySheet';
import { api, type UserId } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { haptic } from '../haptic';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { useTr } from '../utils/addressForm';
import { taskSheetCopy } from '../../../shared/src/tasks/taskSheetCopy';
import { TASK_OPTIONS, STREAK_OPTIONS, type TaskType } from './taskCreate/taskOptions';
import { SchemaPicker, ModePicker } from './taskCreate/TaskPickers';
import { TaskTypeTiles } from './taskCreate/TaskTypeTiles';
import { LimitedTextarea } from '../../../shared/src/components/LimitedTextarea';
import { TASK_TEXT_MAX } from '../../../shared/src/limits/textLimits';
import { taskPayloadText } from '../../../shared/src/tasks/taskPayload';
import { assignLead, assignableOptions } from '../../../shared/src/tasks/assignCopy';
import '../styles/sheet-tasks.css';
import '../styles/task-create.css';

interface Props {
  clientId?: UserId; clientName?: string;
  /** Тип и текст, с которыми лист открывается (шаблоны, «Дать заданием»); zIndex — над листами концептуализации. */
  defaultType?: TaskType; defaultText?: string; zIndex?: number;
  onCreated: () => void; onClose: () => void;
}

export function TaskCreateSheet({ clientId, clientName, defaultType, defaultText, zIndex, onCreated, onClose }: Props) {
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
  const copy = taskSheetCopy(clientId, clientName, tr); // клиент ставит цель себе, терапевт назначает задание

  async function handleCreate() {
    const finalText = taskPayloadText({ type, targetDays, schemaId: selectedSchemaId, modeId: selectedModeId, text }).trim();
    if (type === 'custom' && !finalText) { setError(copy.emptyText); return; }
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
    <div className="sk-sheet" style={zIndex === undefined ? undefined : { zIndex }}>
      <div className="ds-sheet-head">
        <button type="button" className="ds-back" onClick={goBack}><GlyphArrowLeft /> {clientId !== undefined ? 'Назад к карточке' : 'Назад'}</button>
      </div>

      <div className="sk-scroll">
        <div className="sk-page">
          {/* Шапка — лист «задания» (небо 240 + Check): надпись, вопрос одной строкой Literata (до b20 — «Выбери» /
              курсивом «цель» в две строки и мелкий Check над надписью), подводка терапевту. */}
          <EntitySheet look="task" label={copy.title} titleAs="h1"
            title={`${tr('Выбери', 'Выберите')} ${copy.what}`} sub={lead ?? undefined} className="sk-create-head" />

          <TaskTypeTiles options={options} value={type} onPick={setType} />

          <div ref={configRef} className="sk-config">
            {selected.hasStreak && (
              <div className="sk-field">
                <div className="ds-label">Цель в днях</div>
                <div className="ds-seg ds-seg--full">
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
                <div className="ds-label">{copy.textLabel}</div>
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

        </div>
      </div>
      {/* Главная кнопка закреплена внизу листа: на телефоне до неё было девять плиток и настройки. */}
      <div className="sk-submit-bar">
        <div className="sk-submit">
          {error ? <span className="sk-error">{error}</span> : <span />}
          <button className="ds-btn ds-btn--lg" onClick={handleCreate} disabled={!canSave || saving}>
            {saving ? copy.saving : copy.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
