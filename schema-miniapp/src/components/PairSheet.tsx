import { useState, useEffect } from 'react';
import { api, PairsData } from '../api';
import { BottomSheet } from './BottomSheet';

interface Props {
  onClose: () => void;
}

function indexColor(v: number): string {
  if (v >= 7) return '#06d6a0';
  if (v >= 4) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

export function PairSheet({ onClose }: Props) {
  const [data, setData] = useState<PairsData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<'main' | 'join'>('main');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copiedPending, setCopiedPending] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [confirmLeaveCode, setConfirmLeaveCode] = useState<string | null>(null);

  useEffect(() => {
    api.getPair().then(setData).catch(() => setLoadError(true));
  }, []);

  async function handleCreateInvite() {
    setLoading(true);
    try {
      const { url } = await api.createPairInvite();
      setInviteUrl(url);
      api.getPair().then(setData).catch(() => {});
      try { if (navigator.share) await navigator.share({ text: `Давай отслеживать потребности вместе! ${url}` }); } catch {}
    } catch {}
    setLoading(false);
  }

  async function handleCopyPending(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPending(true);
      setTimeout(() => setCopiedPending(false), 2000);
    } catch {}
  }

  async function handleCopyInvite(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {}
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
    ? `https://t.me/SchemaLabBot/diary?startapp=pair_${data.pendingCode}`
    : '';

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Вместе</div>

        {!data ? (
          <div style={{ textAlign: 'center', color: loadError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.3)', padding: '40px 0' }}>
            {loadError ? 'Ошибка загрузки — попробуй закрыть и открыть снова' : 'Загрузка...'}
          </div>
        ) : (
          <>
            {/* Active partners */}
            {data.partners.map(partner => {
              const name = partner.partnerName ?? 'Друг';
              const done = partner.partnerTodayDone && partner.partnerIndex !== null;
              const color = done ? indexColor(partner.partnerIndex!) : 'rgba(var(--fg-rgb),0.35)';
              const idx = partner.partnerIndex ?? 0;
              const contextMsg = !done
                ? `${name} ещё не заполнил дневник — когда заполнит, увидишь как день`
                : idx < 4
                  ? `Сегодня у ${name} непростой день. Иногда просто написать пару слов — уже помогает`
                  : idx < 7
                    ? `${name} в норме сегодня. Отслеживаете вместе — это уже кое-что`
                    : `У ${name} хороший день. Приятно, когда у обоих всё неплохо`;

              return (
                <div key={partner.code} style={{ background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 2 }}>{name} сегодня</div>
                      {done ? (
                        <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>
                          {idx.toFixed(1)}
                          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-sub)' }}>/10</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>Ещё не заполнил</div>
                      )}
                    </div>
                    {partner.partnerTelegramId && (
                      <button
                        onClick={() => { window.location.href = `tg://user?id=${partner.partnerTelegramId}`; }}
                        style={{
                          padding: '8px 14px', border: 'none', borderRadius: 10,
                          background: 'rgba(79,163,247,0.15)', color: '#4fa3f7',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        Написать
                      </button>
                    )}
                  </div>

                  {partner.partnerWeekAvgs?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28, marginBottom: 10 }}>
                      {[...partner.partnerWeekAvgs].reverse().map((v, i) => {
                        const barH = v !== null ? Math.round((v / 10) * 24) : 3;
                        const barColor = v === null ? 'rgba(var(--fg-rgb),0.08)' : indexColor(v);
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div style={{ width: '100%', height: barH, borderRadius: 3, background: barColor, transition: 'height 0.3s' }} />
                            {v !== null && i === partner.partnerWeekAvgs.length - 1 && (
                              <div style={{ fontSize: 9, color: 'var(--text-sub)' }}>сег</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 10 }}>
                    {contextMsg}
                  </div>

                  {confirmLeaveCode === partner.code ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConfirmLeaveCode(null)} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 10, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>Отмена</button>
                      <button onClick={() => handleLeave(partner.code)} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 10, background: 'rgba(255,80,80,0.2)', color: 'var(--accent-red)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Выйти</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmLeaveCode(partner.code)} style={{ width: '100%', padding: '9px', border: 'none', borderRadius: 10, background: 'rgba(255,80,80,0.08)', color: 'rgba(255,100,100,0.6)', fontSize: 13, cursor: 'pointer' }}>
                      Выйти из пары
                    </button>
                  )}
                </div>
              );
            })}

            {/* Pending invite */}
            {data.pendingCode && (
              <div style={{ background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 10 }}>⏳ Ждём партнёра</div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', wordBreak: 'break-all', lineHeight: 1.5, marginBottom: 10, userSelect: 'all' }}>
                  {pendingUrl}
                </div>
                <button
                  onClick={() => handleCopyPending(pendingUrl)}
                  style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 10, background: copiedPending ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : 'color-mix(in srgb, var(--accent) 20%, transparent)', color: copiedPending ? '#06d6a0' : 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {copiedPending ? '✓ Скопировано' : 'Скопировать ссылку'}
                </button>
              </div>
            )}

            {(data.partners.length > 0 || data.pendingCode) && (
              <div style={{ height: 1, background: 'rgba(var(--fg-rgb),0.06)', margin: '8px 0 16px' }} />
            )}

            {/* Add friend section */}
            {view === 'main' ? (
              <>
                {data.partners.length === 0 && !data.pendingCode && (
                  <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 16 }}>
                    Приглашай друга или партнёра — видите индексы дня друг друга. Не детали, только число. Просто знать, как день у другого.
                  </p>
                )}

                {!data.pendingCode && (
                  <button
                    onClick={handleCreateInvite}
                    disabled={loading}
                    style={{ width: '100%', padding: '13px', border: 'none', borderRadius: 12, background: 'var(--accent)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer', marginBottom: 10 }}
                  >
                    {loading ? '...' : data.partners.length > 0 ? 'Пригласить ещё друга' : 'Создать приглашение'}
                  </button>
                )}

                {inviteUrl && (
                  <div style={{ background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 8 }}>Скопируй и отправь другу:</div>
                    <div style={{ fontSize: 12, color: 'rgba(var(--fg-rgb),0.7)', wordBreak: 'break-all', lineHeight: 1.5, marginBottom: 10, userSelect: 'all' }}>{inviteUrl}</div>
                    <button onClick={() => handleCopyInvite(inviteUrl)} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 10, background: copiedInvite ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : 'color-mix(in srgb, var(--accent) 20%, transparent)', color: copiedInvite ? '#06d6a0' : 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {copiedInvite ? '✓ Скопировано' : 'Скопировать ссылку'}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setView('join')}
                  style={{ width: '100%', padding: '13px', border: 'none', borderRadius: 12, background: 'rgba(var(--fg-rgb),0.06)', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer' }}
                >
                  Есть код приглашения
                </button>
              </>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span onClick={() => setView('main')} style={{ fontSize: 22, color: 'var(--text-sub)', cursor: 'pointer' }}>‹</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Ввести код</span>
                </div>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Код из приглашения"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(var(--fg-rgb),0.06)', border: '1px solid rgba(var(--fg-rgb),0.1)', color: 'var(--text)', fontSize: 16, fontFamily: 'monospace', outline: 'none', letterSpacing: 4, textAlign: 'center', boxSizing: 'border-box', marginBottom: 12 }}
                />
                {joinError && <div style={{ fontSize: 13, color: 'var(--accent-red)', textAlign: 'center', marginBottom: 10 }}>{joinError}</div>}
                <button
                  onClick={handleJoin}
                  disabled={!joinCode.trim() || loading}
                  style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: joinCode.trim() ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 30%, transparent)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Присоединиться
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
