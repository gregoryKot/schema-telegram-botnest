import { CrisisGate } from '../CrisisGate';
import { SaveErrorNote } from '../SaveErrorNote';
import { cm } from '../../sections/schemas/utils';

// Финальный шаг: переформулировка. Свободный текст — кризисный гейт живёт
// здесь же (правило №7), переехал вместе с textarea.
// Вынесено из BeliefCheck.tsx (правило №10).
export function ReframeStep({
  reframe,
  setReframe,
  saving,
  saveError,
  onSave,
}: {
  reframe: string;
  setReframe: (v: string) => void;
  saving: boolean;
  saveError: boolean;
  onSave: () => void;
}) {
  return (
    <>
      <div
        style={{
          background: cm('var(--accent)', 6),
          border: `1px solid ${cm('var(--accent)', 12)}`,
          borderRadius: 'var(--r-14)',
          padding: '10px 14px',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--accent)',
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Переформулировка
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
          }}
        >
          Посмотрев на оба списка — как можно сформулировать эту мысль точнее и
          добрее к себе?
        </div>
      </div>
      <textarea
        value={reframe}
        onChange={(e) => setReframe(e.target.value)}
        placeholder="Например: иногда я ошибаюсь, но это не значит что я всегда всё порчу..."
        rows={4}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'rgba(var(--fg-rgb),0.04)',
          border: `1px solid ${reframe.trim() ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`,
          borderRadius: 'var(--r-14)',
          padding: '13px 14px',
          color: 'var(--text)',
          fontSize: 14,
          lineHeight: 1.7,
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          marginBottom: 14,
        }}
      />
      <CrisisGate texts={[reframe]} surface="belief_check" />
      {saveError && (
        <SaveErrorNote
          ty="Не удалось сохранить на сервере. Работа осталась на этом устройстве — попробуй ещё раз."
          vy="Не удалось сохранить на сервере. Работа осталась на этом устройстве — попробуйте ещё раз."
        />
      )}
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          width: '100%',
          padding: '13px 0',
          borderRadius: 'var(--r-14)',
          border: 'none',
          background: cm('var(--accent-green)', 15),
          color: 'var(--accent-green)',
          fontSize: 15,
          fontWeight: 600,
          cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.7 : 1,
          transition: 'all 0.2s',
          marginBottom: 16,
        }}
      >
        {saving ? 'Сохраняю...' : 'Сохранить'}
      </button>
    </>
  );
}
