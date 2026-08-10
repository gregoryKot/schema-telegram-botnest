import { contactCta } from '../../utils/therapistContact';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { YsqDisclaimer } from '../../../../shared/src/components/YsqDisclaimer';
import { YsqResultTopBar } from '../../../../shared/src/components/YsqResultTopBar';
import { YsqActiveDomainList } from './YsqActiveDomainList';
import { YsqInactiveSchemas } from './YsqInactiveSchemas';
import { YsqTherapyCta } from './YsqTherapyCta';
import { YsqHistoryTimeline } from './YsqHistoryTimeline';
import { YsqResultActions } from './YsqResultActions';
import { YsqSyncErrorNote } from './YsqSyncErrorNote';
import type { ResultView, Scores, YsqHistoryEntry } from './types';

interface Props {
  scores: Scores;
  resultView: ResultView;
  ratings?: Record<string, number>;
  history: YsqHistoryEntry[];
  inactiveExpanded: boolean;
  setInactiveExpanded: (updater: (prev: boolean) => boolean) => void;
  retakeConfirm: boolean;
  setRetakeConfirm: (v: boolean) => void;
  onViewSchemas?: (schemaName: string) => void;
  onClose: () => void;
  onShare: () => void;
  onRetake: () => void;
  resultSaveError?: boolean;
  onRetrySaveResult?: () => void;
}

// ── Result phase ──────────────────────────────────────────────────────────────
export function YsqResultView({
  scores,
  resultView,
  ratings,
  history,
  inactiveExpanded,
  setInactiveExpanded,
  retakeConfirm,
  setRetakeConfirm,
  onViewSchemas,
  onClose,
  onShare,
  onRetake,
  resultSaveError,
  onRetrySaveResult,
}: Props) {
  const cta = contactCta();
  const tr = useTr();
  const {
    inactiveSchemas,
    activeByDomain,
    dateLabel,
    activeCount,
    activeLabel,
    getSchemaDelta,
  } = resultView;

  return (
    <div style={{ padding: '8px 0 16px' }}>
      {/* «Как понимать» + «Поделиться» — с самого верха (правило онбординга) */}
      <YsqResultTopBar
        tr={tr}
        onShare={onShare}
        onHelpOpen={() => api.trackEvent('ysq_help_open')}
      />

      {/* Результат виден локально независимо от сервера — без баннера
          выглядит как «сохранено», а при смене устройства пропадёт. */}
      {resultSaveError && onRetrySaveResult && (
        <YsqSyncErrorNote
          ty="Результат посчитан и виден только на этом устройстве — отправить его на сервер не получилось. Попробуй ещё раз, чтобы не потерять при смене устройства."
          vy="Результат посчитан и виден только на этом устройстве — отправить его на сервер не получилось. Попробуйте ещё раз, чтобы не потерять при смене устройства."
          retryLabel="Отправить ещё раз"
          onRetry={onRetrySaveResult}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.5px',
            marginBottom: 4,
          }}
        >
          {activeLabel}
        </div>
        {dateLabel && (
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Пройдено {dateLabel}
          </div>
        )}
      </div>

      {activeCount === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '28px 0',
            fontSize: 14,
            color: 'var(--text-sub)',
          }}
        >
          Выраженных схем не обнаружено — отличный результат.
        </div>
      )}

      {/* Active schemas grouped by domain */}
      <YsqActiveDomainList
        activeByDomain={activeByDomain}
        scores={scores}
        getSchemaDelta={getSchemaDelta}
        ratings={ratings}
        onViewSchemas={onViewSchemas}
        onClose={onClose}
      />

      {/* Inactive schemas — collapsed */}
      <YsqInactiveSchemas
        schemas={inactiveSchemas}
        scores={scores}
        expanded={inactiveExpanded}
        setExpanded={setInactiveExpanded}
      />

      {/* CTA — прячем целиком, если сам пользователь терапевт
          (isSelf): «Написать вам» бессмысленно. */}
      {activeCount > 0 && !cta.isSelf && <YsqTherapyCta cta={cta} />}

      {/* History timeline */}
      {history.length >= 2 && <YsqHistoryTimeline history={history} />}

      <YsqResultActions
        retakeConfirm={retakeConfirm}
        setRetakeConfirm={setRetakeConfirm}
        onClose={onClose}
        onRetake={onRetake}
      />

      <YsqDisclaimer mt={16} />
    </div>
  );
}
