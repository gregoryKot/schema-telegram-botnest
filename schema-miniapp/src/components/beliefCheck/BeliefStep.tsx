import { useTr } from '../../utils/addressForm';
import { CrisisGate } from '../CrisisGate';
import { cm } from '../../sections/schemas/utils';

// Первый шаг проверки убеждения: сама мысль. Свободный текст — поэтому
// здесь же живёт кризисный гейт (правило №7), он переехал вместе с
// textarea. Вынесено из BeliefCheck.tsx (правило №10).
export function BeliefStep({
  belief,
  setBelief,
  onNext,
}: {
  belief: string;
  setBelief: (v: string) => void;
  onNext: () => void;
}) {
  const tr = useTr();
  return (
    <>
      <div
        style={{
          background: cm('var(--accent-blue)', 6),
          border: `1px solid ${cm('var(--accent-blue)', 12)}`,
          borderRadius: 'var(--r-14)',
          padding: '12px 14px',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
          }}
        >
          {tr(
            'Запиши мысль или убеждение, которое тебя беспокоит.',
            'Запишите мысль или убеждение, которое вас беспокоит.',
          )}{' '}
          Схемы часто говорят с нами голосом абсолютных утверждений: «я
          никогда», «всё всегда», «я недостаточно».
        </div>
      </div>
      <textarea
        value={belief}
        onChange={(e) => setBelief(e.target.value)}
        placeholder="Например: я всегда всё порчу, меня никто не любит..."
        rows={4}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'rgba(var(--fg-rgb),0.04)',
          border: `1px solid ${belief.trim() ? cm('var(--accent-blue)', 30) : 'rgba(var(--fg-rgb),0.1)'}`,
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
      <CrisisGate texts={[belief]} surface="belief_check" />
      <button
        onClick={onNext}
        disabled={!belief.trim()}
        style={{
          width: '100%',
          padding: '13px 0',
          borderRadius: 'var(--r-14)',
          border: 'none',
          background: belief.trim()
            ? cm('var(--accent-blue)', 15)
            : 'rgba(var(--fg-rgb),0.06)',
          color: belief.trim()
            ? 'var(--accent-blue)'
            : 'rgba(var(--fg-rgb),0.25)',
          fontSize: 15,
          fontWeight: 600,
          cursor: belief.trim() ? 'pointer' : 'default',
          transition: 'all 0.2s',
        }}
      >
        Дальше →
      </button>
    </>
  );
}
