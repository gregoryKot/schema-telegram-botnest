import { SkeletonLines } from '../Skeleton';
import { PartnerCard } from './PartnerCard';
import { InviteLinkBox } from './InviteLinkBox';
import { JoinCodeView } from './JoinCodeView';
import { usePairTexts } from './inviteTexts';
import { miniappDeepLink } from '../../utils/botConfig';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import type { PairMechanics } from './usePairMechanics';

// Единственная разметка механики «пара с другом» (правило №11 CLAUDE.md) —
// раньше была написана дважды (PairSheet.tsx как отдельный экран,
// PartnerSection.tsx как секция настроек). Логика/состояние приходят
// пропом `pair` (usePairMechanics), сюда — только рендер. `compact` подстраивает
// только размеры скелетона под тесную карточку настроек, остального не трогает.
export function PairPanel({
  pair,
  compact,
}: {
  pair: PairMechanics;
  compact?: boolean;
}) {
  const { tr, inviteText, copyLabel } = usePairTexts();
  const pendingCopy = useCopyToClipboard();
  const inviteCopy = useCopyToClipboard();
  const {
    data,
    loadError,
    loading,
    inviteUrl,
    createError,
    joinView,
    setJoinView,
    joinCode,
    setJoinCode,
    joinError,
    confirmLeaveCode,
    setConfirmLeaveCode,
    handleCreateInvite,
    handleJoin,
    handleLeave,
  } = pair;

  if (!data) {
    return (
      <div
        style={{
          textAlign: 'center',
          color: loadError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.3)',
          padding: compact ? '12px 0' : '40px 0',
        }}
      >
        {loadError ? (
          tr(
            'Ошибка загрузки — попробуй закрыть и открыть снова',
            'Ошибка загрузки — попробуйте закрыть и открыть снова',
          )
        ) : (
          <SkeletonLines
            widths={compact ? ['70%', '50%'] : ['70%', '90%', '55%']}
          />
        )}
      </div>
    );
  }

  if (joinView === 'join') {
    return (
      <JoinCodeView
        code={joinCode}
        setCode={setJoinCode}
        error={joinError}
        loading={loading}
        onSubmit={handleJoin}
        onBack={() => setJoinView('main')}
      />
    );
  }

  const pendingUrl = data.pendingCode
    ? miniappDeepLink(`pair_${data.pendingCode}`)
    : '';

  return (
    <>
      {data.partners.map((partner) => (
        <PartnerCard
          key={partner.code}
          partner={partner}
          confirmLeaveCode={confirmLeaveCode}
          setConfirmLeaveCode={setConfirmLeaveCode}
          onLeave={handleLeave}
        />
      ))}

      {data.pendingCode && (
        <div style={{ marginBottom: 12 }}>
          <InviteLinkBox
            label="⏳ Ждём партнёра"
            url={pendingUrl}
            copied={pendingCopy.copied}
            failed={pendingCopy.failed}
            onCopy={() => void pendingCopy.copy(pendingUrl)}
          />
        </div>
      )}

      {(data.partners.length > 0 || data.pendingCode) && (
        <div
          style={{
            height: 1,
            background: 'rgba(var(--fg-rgb),0.06)',
            margin: '8px 0 16px',
          }}
        />
      )}

      {data.partners.length === 0 && !data.pendingCode && (
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          {inviteText}
        </p>
      )}

      {!data.pendingCode && (
        <button
          onClick={handleCreateInvite}
          disabled={loading}
          style={{
            width: '100%',
            padding: '13px',
            border: 'none',
            borderRadius: 'var(--r-12)',
            background: 'var(--accent)',
            color: 'var(--text)',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            marginBottom: 10,
          }}
        >
          {loading
            ? '...'
            : createError
              ? 'Не получилось — попробовать ещё раз'
              : data.partners.length > 0
                ? 'Пригласить ещё друга'
                : 'Создать приглашение'}
        </button>
      )}

      {inviteUrl && (
        <div style={{ marginBottom: 10 }}>
          <InviteLinkBox
            label={copyLabel}
            url={inviteUrl}
            copied={inviteCopy.copied}
            failed={inviteCopy.failed}
            onCopy={() => void inviteCopy.copy(inviteUrl)}
          />
        </div>
      )}

      <button
        onClick={() => setJoinView('join')}
        style={{
          width: '100%',
          padding: '13px',
          border: 'none',
          borderRadius: 'var(--r-12)',
          background: 'rgba(var(--fg-rgb),0.06)',
          color: 'var(--text-sub)',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Есть код приглашения
      </button>
    </>
  );
}
