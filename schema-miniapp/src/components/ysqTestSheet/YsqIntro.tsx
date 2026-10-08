import { YsqDisclaimer } from '../../../../shared/src/components/YsqDisclaimer';
import { YsqSyncErrorNote } from '../../../../shared/src/components/YsqSyncErrorNote';
import { YsqAnswerScalePreview } from './YsqAnswerScalePreview';
import { YsqIntroFacts } from './YsqIntroFacts';

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
        <div className="u-sub14-lh15">
          Паттерны мышления и поведения, сложившиеся в детстве
        </div>
      </div>

      <YsqIntroFacts />

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
        Ответы привязаны к аккаунту и не передаются третьим лицам.
      </div>

      {/* Прогресс мог остаться на другом устройстве — без баннера «Начать
          тест» выглядит безопасным, а ответ перезапишет его на сервере. */}
      {!hasProgress && resumeCheckFailed && onRetryResumeCheck && (
        <YsqSyncErrorNote variant="resume-check" onRetry={onRetryResumeCheck} />
      )}

      {hasProgress ? (
        <>
          <button onClick={onContinue} className="btn-primary u-mb10">
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
        <button onClick={onStartFresh} className="btn-primary u-mb10">
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
