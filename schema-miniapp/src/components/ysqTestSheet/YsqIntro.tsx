import { YsqDisclaimer } from '../../../../shared/src/components/YsqDisclaimer';
import { YsqSyncErrorNote } from '../../../../shared/src/components/YsqSyncErrorNote';
import { YsqAnswerScalePreview } from './YsqAnswerScalePreview';

interface Props {
  hasProgress: boolean;
  progressAnswered: number;
  onContinue: () => void;
  onStartFresh: () => void;
  onClose: () => void;
  resumeCheckFailed?: boolean;
  onRetryResumeCheck?: () => void;
}

// ── Intro phase ───────────────────────────────────────────────────────────────
export function YsqIntro({
  hasProgress,
  progressAnswered,
  onContinue,
  onStartFresh,
  onClose,
  resumeCheckFailed,
  onRetryResumeCheck,
}: Props) {
  return (
    <div style={{ padding: '8px 0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🧠</div>
        <div
          style={{
            fontSize: 23,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.5px',
            marginBottom: 6,
          }}
        >
          Тест на схемы
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
          }}
        >
          Паттерны мышления и поведения, сложившиеся в детстве
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
          marginBottom: 20,
        }}
      >
        {[
          ['116 утверждений', 'Оцени каждое от 1 до 6'],
          ['~10 минут', 'Можно прервать — прогресс сохраняется'],
          ['20 схем', 'Результат с описанием и советом для каждой'],
        ].map(([title, desc]) => (
          <div
            key={title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-14)',
              background: 'rgba(var(--fg-rgb),0.04)',
              borderRadius: 'var(--r-14)',
              padding: '12px 16px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text)',
                }}
              >
                {title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  marginTop: 1,
                }}
              >
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <YsqAnswerScalePreview />

      <div
        style={{
          fontSize: 12,
          color: 'var(--text-faint)',
          lineHeight: 1.5,
          marginBottom: 20,
          textAlign: 'center',
        }}
      >
        Ответы привязаны к аккаунту Telegram и не передаются третьим лицам.
      </div>

      {/* Прогресс мог остаться на другом устройстве — без баннера «Начать
          тест» выглядит безопасным, а ответ перезапишет его на сервере. */}
      {!hasProgress && resumeCheckFailed && onRetryResumeCheck && (
        <YsqSyncErrorNote variant="resume-check" onRetry={onRetryResumeCheck} />
      )}

      {hasProgress ? (
        <>
          <button
            onClick={onContinue}
            className="btn-primary"
            style={{ marginBottom: 10 }}
          >
            Продолжить ({progressAnswered} из 116)
          </button>
          <button
            onClick={onStartFresh}
            style={{
              width: '100%',
              padding: '14px 0',
              border: 'none',
              borderRadius: 'var(--r-14)',
              background: 'rgba(var(--fg-rgb),0.07)',
              color: 'var(--text-sub)',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            Начать заново
          </button>
        </>
      ) : (
        <button
          onClick={onStartFresh}
          className="btn-primary"
          style={{ marginBottom: 10 }}
        >
          Начать тест
        </button>
      )}

      <button
        onClick={onClose}
        style={{
          width: '100%',
          padding: '14px 0',
          border: 'none',
          borderRadius: 'var(--r-14)',
          background: 'rgba(var(--fg-rgb),0.07)',
          color: 'var(--text-sub)',
          fontSize: 15,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Отмена
      </button>

      <YsqDisclaimer mt={20} />
    </div>
  );
}
