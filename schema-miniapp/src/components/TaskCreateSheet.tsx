import { useState, useRef, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { api } from '../api';
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

// Тип задания переехал в taskCreate/options вместе с каталогом —
// ре-экспорт держит прежний путь импорта у потребителей.
export type { TaskType };

interface Props {
  clientId?: number;
  clientName?: string;
  defaultType?: TaskType;
  onCreated: () => void;
  onClose: () => void;
}

export function getTaskDisplayText(type: string, text: string): string {
  if (type === 'schema_intro') {
    const s = ALL_SCHEMAS_FLAT.find((x) => x.id === text);
    return s ? `Карточка схемы: ${s.name}` : 'Карточка схемы';
  }
  if (type === 'mode_intro') {
    const m = ALL_MODES.find((x) => x.id === text);
    return m ? `Карточка режима: ${m.name}` : 'Карточка режима';
  }
  return text;
}

export function TaskCreateSheet({
  clientId,
  clientName,
  defaultType,
  onCreated,
  onClose,
}: Props) {
  const tr = useTr();
  const [type, setType] = useState<TaskType>(defaultType ?? 'diary_streak');
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

  const selected = TASK_OPTIONS.find((o) => o.type === type)!;

  function getPayloadText(): string {
    switch (type) {
      case 'diary_streak':
        return `Заполнять дневник ${targetDays} дней подряд`;
      case 'tracker_streak':
        return `Отмечать потребности ${targetDays} дней подряд`;
      case 'schema_intro':
        return selectedSchemaId;
      case 'mode_intro':
        return selectedModeId;
      case 'belief_check':
        return 'Проверить убеждение';
      case 'letter_to_self':
        return 'Написать письмо Уязвимому Ребёнку';
      case 'safe_place':
        return 'Описать Безопасное место';
      case 'flashcard':
        return 'Разобрать сложную ситуацию по шагам';
      default:
        return text;
    }
  }

  async function handleCreate() {
    const finalText = getPayloadText().trim();
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
      <TaskTypeSelector type={type} onPick={setType} />
      {/* Streak day picker */}
      {selected.hasStreak && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel mb={8}>Цель в днях</SectionLabel>
          <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
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
        <div style={{ marginBottom: 20 }}>
          <SectionLabel mb={8}>Описание задания</SectionLabel>
          <textarea
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
        <div style={{ marginBottom: 24 }}>
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
