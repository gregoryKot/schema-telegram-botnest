// Шаг «переписать»: вердикт по приметам + поле для новой формулировки.
// Подсказка — правая колонка таблицы самокоррекции: факт, влияние,
// следующий шаг. Кризисный гейт обязателен (правило №7).
import { CrisisGate } from '../CrisisGate';
import { buildVerdict } from '../../../../shared/src/phraseCheck/verdict';
import type { PhraseMarkId } from '../../../../shared/src/phraseCheck/criteria';

export function RewriteStep({
  marks,
  rewrite,
  setRewrite,
  inWarmWords,
  setInWarmWords,
  onSave,
  tr,
}: {
  marks: PhraseMarkId[];
  rewrite: string;
  setRewrite: (v: string) => void;
  inWarmWords: boolean;
  setInWarmWords: (v: boolean) => void;
  onSave: () => void;
  tr: (ty: string, vy: string) => string;
}) {
  const verdict = buildVerdict(marks);
  return (
    <>
      <div
        style={{
          background: 'rgba(var(--fg-rgb),0.04)',
          border: '1px solid rgba(var(--fg-rgb),0.08)',
          borderRadius: 'var(--r-14)',
          padding: '13px 15px',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {verdict.emoji} {verdict.title}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--text-sub)',
            marginTop: 5,
          }}
        >
          {verdict.text}
        </div>
      </div>

      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.6,
          color: 'var(--text-sub)',
          marginBottom: 10,
        }}
      >
        {verdict.suggestRewrite
          ? tr(
              'Скажи то же самое голосом, который помогает: что случилось (факт), на что это влияет, что делаешь в следующий раз.',
              'Скажите то же самое голосом, который помогает: что случилось (факт), на что это влияет, что делаете в следующий раз.',
            )
          : tr(
              'Можно записать эту фразу дословно — пусть останется под рукой как образец.',
              'Можно записать эту фразу дословно — пусть останется под рукой как образец.',
            )}
      </div>

      <textarea
        value={rewrite}
        onChange={(e) => setRewrite(e.target.value)}
        placeholder="Например: отчёт ушёл с ошибкой в цифрах. Это неприятно, но поправимо — в следующий раз проверяю итоги дважды"
        rows={4}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'rgba(var(--fg-rgb),0.04)',
          border: `1px solid ${rewrite.trim() ? 'color-mix(in srgb, var(--accent-green) 30%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`,
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
      <CrisisGate texts={[rewrite]} surface="phrase_check" />

      {/* Переписанная фраза — это и есть слова поддержки себе; предлагаем
          забрать её в «Тёплые слова», но решает пользователь. */}
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-10)',
          padding: '11px 13px',
          borderRadius: 'var(--r-14)',
          background: rewrite.trim()
            ? 'color-mix(in srgb, var(--accent-yellow) 8%, transparent)'
            : 'rgba(var(--fg-rgb),0.03)',
          border: `1px solid ${rewrite.trim() ? 'color-mix(in srgb, var(--accent-yellow) 20%, transparent)' : 'rgba(var(--fg-rgb),0.08)'}`,
          marginBottom: 14,
          cursor: rewrite.trim() ? 'pointer' : 'default',
          opacity: rewrite.trim() ? 1 : 0.5,
        }}
      >
        <input
          type="checkbox"
          checked={inWarmWords && Boolean(rewrite.trim())}
          disabled={!rewrite.trim()}
          onChange={(e) => setInWarmWords(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0 }}
        />
        <span
          style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-sub)' }}
        >
          💛 Добавить в «Тёплые слова»
          <span
            style={{
              display: 'block',
              fontSize: 11.5,
              color: 'var(--text-faint)',
              marginTop: 2,
            }}
          >
            Будет лежать вместе с другими словами поддержки — перечитать, когда
            снова накроет.
          </span>
        </span>
      </label>

      <button
        onClick={onSave}
        className="btn-primary"
        style={{ width: '100%', marginBottom: 12 }}
      >
        Сохранить разбор
      </button>
    </>
  );
}
