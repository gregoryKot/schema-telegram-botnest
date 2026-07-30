import { useState, useEffect } from 'react';
import { pressable } from '../utils/a11y';
import { SkeletonLines } from './Skeleton';
import { api, PairsData } from '../api';
import { PartnerCard } from './pairSheet/PartnerCard';
import { BottomSheet } from './BottomSheet';
import { miniappDeepLink } from '../utils/botConfig';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { pairInviteShare } from '../../../shared/src/share/cards/inviteShare';

interface Props {
  onClose: () => void;
}

export function PairSheet({ onClose }: Props) {
  const [data, setData] = useState<PairsData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<'main' | 'join'>('main');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteShare, setShowInviteShare] = useState(false);
  const [copiedPending, setCopiedPending] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [confirmLeaveCode, setConfirmLeaveCode] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPair()
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  async function handleCreateInvite() {
    setLoading(true);
    try {
      const { code, url } = await api.createPairInvite();
      setInviteUrl(url);
      setInviteCode(code);
      api
        .getPair()
        .then(setData)
        .catch(() => {});
      // Красивая карточка-приглашение вместо голого текста
      setShowInviteShare(true);
    } catch {
      /* best-effort: ошибку намеренно игнорируем */
    }
    setLoading(false);
  }

  async function handleCopyPending(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPending(true);
      setTimeout(() => setCopiedPending(false), 2000);
    } catch {
      /* best-effort: ошибку намеренно игнорируем */
    }
  }

  async function handleCopyInvite(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      /* best-effort: ошибку намеренно игнорируем */
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading(true);
    setJoinError('');
    try {
      await api.joinPair(joinCode.trim().toUpperCase());
      setData(await api.getPair());
      setView('main');
      setJoinCode('');
    } catch {
      setJoinError('Код не найден или уже использован');
    }
    setLoading(false);
  }

  async function handleLeave(code: string) {
    try {
      await api.leavePair(code);
      setData(await api.getPair());
      setConfirmLeaveCode(null);
    } catch {
      setConfirmLeaveCode(null);
    }
  }

  const pendingUrl = data?.pendingCode
    ? miniappDeepLink(`pair_${data.pendingCode}`)
    : '';

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 20,
          }}
        >
          Вместе
        </div>

        {!data ? (
          <div
            style={{
              textAlign: 'center',
              color: loadError
                ? 'var(--accent-red)'
                : 'rgba(var(--fg-rgb),0.3)',
              padding: '40px 0',
            }}
          >
            {loadError ? (
              'Ошибка загрузки — попробуй закрыть и открыть снова'
            ) : (
              <SkeletonLines widths={['70%', '90%', '55%']} />
            )}
          </div>
        ) : (
          <>
            {/* Active partners */}
            {data.partners.map((partner) => (
              <PartnerCard
                key={partner.code}
                partner={partner}
                confirmLeaveCode={confirmLeaveCode}
                setConfirmLeaveCode={setConfirmLeaveCode}
                onLeave={handleLeave}
              />
            ))}

            {/* Pending invite */}
            {data.pendingCode && (
              <div
                style={{
                  background: 'rgba(var(--fg-rgb),0.04)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-sub)',
                    marginBottom: 10,
                  }}
                >
                  ⏳ Ждём партнёра
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-sub)',
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                    marginBottom: 10,
                    userSelect: 'all',
                  }}
                >
                  {pendingUrl}
                </div>
                <button
                  onClick={() => handleCopyPending(pendingUrl)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: 'none',
                    borderRadius: 10,
                    background: copiedPending
                      ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                      : 'color-mix(in srgb, var(--accent) 20%, transparent)',
                    color: copiedPending ? '#06d6a0' : 'var(--accent)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copiedPending ? '✓ Скопировано' : 'Скопировать ссылку'}
                </button>
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

            {/* Add friend section */}
            {view === 'main' ? (
              <>
                {data.partners.length === 0 && !data.pendingCode && (
                  <p
                    style={{
                      fontSize: 14,
                      color: 'var(--text-sub)',
                      lineHeight: 1.6,
                      marginBottom: 16,
                    }}
                  >
                    Приглашай друга или партнёра — увидите индексы дня друг
                    друга, без подробностей. Только число от 0 до 10 — просто
                    чтобы знать, как дела у другого.
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
                      borderRadius: 12,
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
                      : data.partners.length > 0
                        ? 'Пригласить ещё друга'
                        : 'Создать приглашение'}
                  </button>
                )}

                {inviteUrl && (
                  <div
                    style={{
                      background: 'rgba(var(--fg-rgb),0.04)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-sub)',
                        marginBottom: 8,
                      }}
                    >
                      Скопируй и отправь другу:
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'rgba(var(--fg-rgb),0.7)',
                        wordBreak: 'break-all',
                        lineHeight: 1.5,
                        marginBottom: 10,
                        userSelect: 'all',
                      }}
                    >
                      {inviteUrl}
                    </div>
                    <button
                      onClick={() => handleCopyInvite(inviteUrl)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: 'none',
                        borderRadius: 10,
                        background: copiedInvite
                          ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                          : 'color-mix(in srgb, var(--accent) 20%, transparent)',
                        color: copiedInvite ? '#06d6a0' : 'var(--accent)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {copiedInvite ? '✓ Скопировано' : 'Скопировать ссылку'}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setView('join')}
                  style={{
                    width: '100%',
                    padding: '13px',
                    border: 'none',
                    borderRadius: 12,
                    background: 'rgba(var(--fg-rgb),0.06)',
                    color: 'var(--text-sub)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Есть код приглашения
                </button>
              </>
            ) : (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <span
                    {...pressable(() => setView('main'))}
                    style={{
                      fontSize: 22,
                      color: 'var(--text-sub)',
                      cursor: 'pointer',
                    }}
                  >
                    ‹
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    Ввести код
                  </span>
                </div>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Код из приглашения"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(var(--fg-rgb),0.06)',
                    border: '1px solid rgba(var(--fg-rgb),0.1)',
                    color: 'var(--text)',
                    fontSize: 16,
                    fontFamily: 'monospace',
                    outline: 'none',
                    letterSpacing: 4,
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    marginBottom: 12,
                  }}
                />
                {joinError && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--accent-red)',
                      textAlign: 'center',
                      marginBottom: 10,
                    }}
                  >
                    {joinError}
                  </div>
                )}
                <button
                  onClick={handleJoin}
                  disabled={!joinCode.trim() || loading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    border: 'none',
                    borderRadius: 12,
                    background: joinCode.trim()
                      ? 'var(--accent)'
                      : 'color-mix(in srgb, var(--accent) 30%, transparent)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Присоединиться
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showInviteShare && inviteCode && (
        <ShareCardSheet
          {...pairInviteShare(inviteCode, inviteUrl)}
          onClose={() => setShowInviteShare(false)}
          zIndex={300}
        />
      )}
    </BottomSheet>
  );
}
