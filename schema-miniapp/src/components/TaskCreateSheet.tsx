import { useState, useRef, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { api, type UserId } from '../api';
import { ALL_MODES } from '../schemaTherapyData';
import { pressable } from '../utils/a11y';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { useTr } from '../utils/addressForm';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import {
  STREAK_OPTIONS,
  TASK_OPTIONS,
  ALL_SCHEMAS_FLAT,
  type TaskType,
} from './taskCreate/options';
import { TaskEntityPicker } from './taskCreate/TaskEntityPicker';
import { TaskTypeSelector } from './taskCreate/TaskTypeSelector';
import { LimitedTextarea } from '../../../shared/src/components/LimitedTextarea';
import { TASK_TEXT_MAX } from '../../../shared/src/limits/textLimits';
import { taskPayloadText } from '../../../shared/src/tasks/taskPayload';
import {
  assignLead,
  assignableOptions,
} from '../../../shared/src/tasks/assignCopy';

// Тип задания переехал в taskCreate/options вместе с каталогом —
// ре-экспорт держит прежний путь импорта у потребителей.
export type { TaskType };

interface Props {
  clientId?: UserId;
  clientName?: string;
  defaultType?: TaskType;
  onCreated: () => void;
  onClose: () => void;
}

export function TaskCreateSheet({
  clientId,
  clientName,
  defaultType,
  onCreated,
  onClose,
}: Props) {
  const tr = useTr();
  // Офлайн-клиенту — только «Своё задание» (shared/tasks/assignCopy).
  const options = assignableOptions(TASK_OPTIONS, clientId);
  const [type, setType] = useState<TaskType>(
    () =>
      options.find((o) => o.type === (defaultType ?? 'diary_streak'))?.type ??
      options[0].type,
  );
  const [targetDays, setTargetDays] = useState(7);
  const [text, setText] = useState('');
  const [selectedSchemaId, setSelectedSchemaId] = useState('');
  const [selectedModeId, setSelectedModeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const configRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      (type === 'schema_intro' || type === 'mode_intro') &&
      configRef.current
    ) {
      setTimeout(
        () => scrollIntoViewSafe(configRef.current, { block: 'nearest' }),
        50,
      );
    }
  }, [type]);

  const selected = options.find((o) => o.type === type) ?? options[0];
  const lead = assignLead(clientId);

  async function handleCreate() {
    const finalText = taskPayloadText({
      type,
      targetDays,
      schemaId: selectedSchemaId,
      modeId: selectedModeId,
      text,
    }).trim();
    if (type === 'custom' && !finalText) {
      setError(tr('Введи описание задания', 'Введите описание задания'));
      return;
    }
    if (type === 'schema_intro' && !selectedSchemaId) {
      setError(tr('Выбери схему', 'Выберите схему'));
      return;
    }
    if (type === 'mode_intro' && !selectedModeId) {
      setError(tr('Выбери режим', 'Выберите режим'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createTask({
        type,
        text: finalText,
        targetDays: selected.hasStreak ? targetDays : undefined,
        dueDate: dueDate || undefined,
        clientId,
      });
      onCreated();
    } catch {
      setError('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <SectionLabel purple mb={16} as="h2">
        {clientName ? `Задание для ${clientName}` : 'Новое задание'}
      </SectionLabel>

      {/* Type selector */}
      {/* Выбор типа задания */}
      {lead && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          {lead}
        </div>
      )}
      <TaskTypeSelector options={options} type={type} onPick={setType} />
      {/* Streak day picker */}
      {selected.hasStreak && (
        <div className="u-mb20">
          <SectionLabel mb={8}>Цель в днях</SectionLabel>
          <div className="u-row8">
            {STREAK_OPTIONS.map((d) => (
              <div
                key={d}
                {...pressable(() => setTargetDays(d))}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px 0',
                  borderRadius: 'var(--r-10)',
                  cursor: 'pointer',
                  background:
                    targetDays === d
                      ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
                      : 'rgba(var(--fg-rgb),0.05)',
                  border: `1px solid ${targetDays === d ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.1)'}`,
                  fontSize: 14,
                  fontWeight: 600,
                  color:
                    targetDays === d
                      ? 'var(--accent)'
                      : 'rgba(var(--fg-rgb),0.5)',
                }}
              >
                {d}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Выбор схемы/режима — один контрол на оба случая */}
      {type === 'schema_intro' && (
        <TaskEntityPicker
          containerRef={configRef}
          label="Какую схему изучить?"
          items={ALL_SCHEMAS_FLAT}
          selectedId={selectedSchemaId}
          onSelect={setSelectedSchemaId}
        />
      )}

      {type === 'mode_intro' && (
        <TaskEntityPicker
          containerRef={configRef}
          label="Какой режим изучить?"
          items={ALL_MODES}
          selectedId={selectedModeId}
          onSelect={setSelectedModeId}
        />
      )}

      {/* Custom text */}
      {type === 'custom' && (
        <div className="u-mb20">
          <SectionLabel mb={8}>Описание задания</SectionLabel>
          <LimitedTextarea
            max={TASK_TEXT_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: позвонить другу раз в неделю"
            style={{
              width: '100%',
              minHeight: 72,
              background: 'rgba(var(--fg-rgb),0.05)',
              border: '1px solid rgba(var(--fg-rgb),0.12)',
              borderRadius: 'var(--r-12)',
              padding: '10px 12px',
              color: 'var(--text)',
              fontSize: 14,
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
          {/* правило №7: свободный текст обязан проходить кризисную детекцию */}
          {detectCrisisAny(text) && <CrisisCard surface="task" />}
        </div>
      )}

      {/* Due date */}
      {(type === 'custom' || clientId) && (
        <div className="u-mb24">
          <SectionLabel mb={8}>Срок (необязательно)</SectionLabel>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(var(--fg-rgb),0.05)',
              border: '1px solid rgba(var(--fg-rgb),0.12)',
              borderRadius: 'var(--r-12)',
              padding: '10px 12px',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {error && (
        <div
          style={{ fontSize: 13, color: 'var(--accent-red)', marginBottom: 12 }}
        >
          {error}
        </div>
      )}

      <button onClick={handleCreate} disabled={saving} className="btn-primary">
        {saving ? 'Сохраняю...' : 'Создать задание'}
      </button>
    </BottomSheet>
  );
}
