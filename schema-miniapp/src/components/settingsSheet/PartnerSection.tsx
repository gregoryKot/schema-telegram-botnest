import { PairsData } from '../../api';
import { SectionHeader } from './primitives';

export function PartnerSection({
  pairLoading,
  pairData,
  joinView,
  setJoinView,
  handleLeave,
  handleCreateInvite,
  pairInviteUrl,
  handleCopyPairInvite,
  pairInviteCopied,
  joinCode,
  setJoinCode,
  joinError,
  handleJoin,
  onInfo,
}: {
  pairLoading: boolean;
  pairData: PairsData | null;
  joinView: 'main' | 'join';
  setJoinView: (v: 'main' | 'join') => void;
  handleLeave: (code: string) => void;
  handleCreateInvite: () => void;
  pairInviteUrl: string;
  handleCopyPairInvite: () => void;
  pairInviteCopied: boolean;
  joinCode: string;
  setJoinCode: (v: string) => void;
  joinError: boolean;
  handleJoin: () => void;
  onInfo: () => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <SectionHeader onInfo={onInfo}>ПАРТНЁР</SectionHeader>
      <div className="card" style={{ borderRadius: 16, padding: 16 }}>
        {pairLoading && !pairData ? (
          <div
            style={{
              color: 'var(--text-sub)',
              fontSize: 13,
              textAlign: 'center',
              padding: '12px 0',
            }}
          >
            Загрузка...
          </div>
        ) : pairData && pairData.partners.length > 0 ? (
          <div>
            {pairData.partners.map((p) => (
              <div key={p.code} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-sub)',
                    marginBottom: 6,
                  }}
                >
                  {p.partnerName ?? 'Друг'} сегодня
                </div>
                {p.partnerTodayDone && p.partnerIndex !== null ? (
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: 'var(--text)',
                      marginBottom: 10,
                    }}
                  >
                    {(p.partnerIndex ?? 0).toFixed(1)}
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 400,
                        color: 'var(--text-sub)',
                      }}
                    >
                      /10
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: 'var(--text-sub)',
                      marginBottom: 10,
                    }}
                  >
                    Ещё не заполнил дневник
                  </div>
                )}
                <button
                  onClick={() => handleLeave(p.code)}
                  style={{
                    width: '100%',
                    padding: 12,
                    border: 'none',
                    borderRadius: 12,
                    background: 'rgba(255,100,100,0.1)',
                    color: 'rgba(255,100,100,0.7)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Выйти из пары
                </button>
              </div>
            ))}
          </div>
        ) : joinView === 'main' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                lineHeight: 1.6,
                marginBottom: 4,
              }}
            >
              Приглашай друга — видите индексы дня друг друга
            </div>
            <button
              onClick={handleCreateInvite}
              disabled={pairLoading}
              style={{
                padding: 14,
                border: 'none',
                borderRadius: 12,
                background: 'var(--accent)',
                color: 'var(--text)',
                fontSize: 14,
                fontWeight: 600,
                cursor: pairLoading ? 'default' : 'pointer',
              }}
            >
              {pairLoading
                ? '...'
                : pairData?.pendingCode
                  ? 'Создать новую ссылку'
                  : 'Создать приглашение'}
            </button>
            {pairInviteUrl && (
              <div
                style={{
                  background: 'rgba(var(--fg-rgb),0.04)',
                  borderRadius: 12,
                  padding: '12px 14px',
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
                  {pairInviteUrl}
                </div>
                <button
                  onClick={handleCopyPairInvite}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: 'none',
                    borderRadius: 10,
                    background: pairInviteCopied
                      ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                      : 'color-mix(in srgb, var(--accent) 20%, transparent)',
                    color: pairInviteCopied ? '#06d6a0' : 'var(--accent)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {pairInviteCopied ? '✓ Скопировано' : 'Скопировать ссылку'}
                </button>
              </div>
            )}
            <button
              onClick={() => setJoinView('join')}
              style={{
                padding: 14,
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
          </div>
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
                onClick={() => setJoinView('main')}
                role="button"
                tabIndex={0}
                aria-label="Назад"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setJoinView('main');
                  }
                }}
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
                  fontSize: 12,
                  color: 'var(--accent-red)',
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                Код не найден или уже использован
              </div>
            )}
            <button
              onClick={handleJoin}
              disabled={!joinCode.trim() || pairLoading}
              style={{
                width: '100%',
                padding: 14,
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
      </div>
    </div>
  );
}
