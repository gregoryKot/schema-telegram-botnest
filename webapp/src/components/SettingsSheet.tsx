import { useState, useEffect } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api } from '../api';
import type { UserSettings, PairsData, TherapyRelationInfo } from '../api';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from '../utils/storageKeys';
import { Loader } from './Loader';
import { getTheme, toggleTheme, resetToSystemTheme } from '../utils/theme';
import type { Theme } from '../utils/theme';

const TIMEZONES = [
  { label: 'Лос-Анджелес (UTC−8)', iana: 'America/Los_Angeles' },
  { label: 'Нью-Йорк (UTC−5)',      iana: 'America/New_York' },
  { label: 'Лондон (UTC+0)',         iana: 'Europe/London' },
  { label: 'Берлин (UTC+1)',         iana: 'Europe/Berlin' },
  { label: 'Киев / Израиль (UTC+2)', iana: 'Europe/Kyiv' },
  { label: 'Москва (UTC+3)',         iana: 'Europe/Moscow' },
  { label: 'Дубай (UTC+4)',          iana: 'Asia/Dubai' },
  { label: 'Ташкент (UTC+5)',        iana: 'Asia/Tashkent' },
  { label: 'Алматы (UTC+6)',         iana: 'Asia/Almaty' },
  { label: 'Пекин (UTC+8)',          iana: 'Asia/Shanghai' },
];
const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
function pad(n: number) { return String(n).padStart(2, '0'); }

interface Props {
  onClose: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  displayName?: string | null;
  onNameChanged?: (name: string) => void;
  onOpenTherapistCabinet?: () => void;
  therapistMode?: boolean;
  onToggleTherapistMode?: () => void;
}

export function SettingsSheet({ onClose, userRole, displayName, onNameChanged, onOpenTherapistCabinet, therapistMode, onToggleTherapistMode }: Props) {
  const goBack = useHistorySheet(onClose);
  const [subView, setSubView] = useState<'main' | 'time' | 'tz'>('main');
  const [settings, setSettings]     = useState<UserSettings | null>(null);
  const [pairData, setPairData]     = useState<PairsData | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairInviteUrl, setPairInviteUrl] = useState('');
  const [pairInviteCopied, setPairInviteCopied] = useState(false);
  const [joinCode, setJoinCode]     = useState('');
  const [joinView, setJoinView]     = useState<'main' | 'join'>('main');
  const [joinError, setJoinError]   = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportCopied, setExportCopied] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [therapyRelation, setTherapyRelation] = useState<TherapyRelationInfo | null | undefined>(undefined);
  const [therapyJoinCode, setTherapyJoinCode] = useState('');
  const [therapyJoinError, setTherapyJoinError] = useState('');
  const [therapyInviteUrl, setTherapyInviteUrl] = useState('');
  const [editName, setEditName] = useState(displayName ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme);
  // Therapist request form
  const [therapistReq, setTherapistReq] = useState<{ status: string; rejectReason: string | null } | null | undefined>(undefined);
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqFullName, setReqFullName] = useState('');
  const [reqQual, setReqQual] = useState('');
  const [reqContacts, setReqContacts] = useState('');
  const [reqMsg, setReqMsg] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  const [reqError, setReqError] = useState('');

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(() => setSettings({ notifyEnabled: false, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow', notifyReminderEnabled: false, pairCardDismissed: false, mySchemaIds: [], myModeIds: [], therapistShareCards: true, therapistShareProfile: true }));
    setPairLoading(true);
    api.getPair().then(setPairData).catch(() => {}).finally(() => setPairLoading(false));
    api.getTherapyRelation().then(setTherapyRelation).catch(() => setTherapyRelation(null));
    if (userRole !== 'THERAPIST') {
      api.getTherapistRequest().then(r => setTherapistReq(r)).catch(() => setTherapistReq(null));
    }
  }, [userRole]);

  async function patch(update: Partial<UserSettings>) {
    if (!settings) return;
    setSettings(s => s ? { ...s, ...update } : s);
    await api.updateSettings(update).catch(() => {});
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  }

  async function handleCreateInvite() {
    setPairLoading(true);
    try {
      const { url } = await api.createPairInvite();
      await api.getPair().then(setPairData);
      setPairInviteUrl(url);
      try { if (navigator.share) await navigator.share({ text: `Давай отслеживать потребности вместе! ${url}` }); } catch {}
    } finally { setPairLoading(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setPairLoading(true); setJoinError(false);
    try {
      await api.joinPair(joinCode.trim().toUpperCase());
      await api.getPair().then(setPairData);
      setJoinView('main');
    } catch { setJoinError(true); } finally { setPairLoading(false); }
  }

  async function submitTherapistRequest() {
    setReqError('');
    if (!reqFullName.trim() || !reqQual.trim() || !reqContacts.trim()) {
      setReqError('Заполни ФИО, квалификацию и контакты');
      return;
    }
    setReqBusy(true);
    try {
      await api.submitTherapistRequest({ fullName: reqFullName.trim(), qualification: reqQual.trim(), contacts: reqContacts.trim(), message: reqMsg.trim() || undefined });
      setTherapistReq({ status: 'pending', rejectReason: null });
      setShowReqForm(false);
    } catch (e) { setReqError(String(e).replace('Error: ', '')); }
    finally { setReqBusy(false); }
  }

  if (!settings) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader minHeight="40vh" />
      </div>
    );
  }

  const localHour = settings.notifyLocalHour;
  const tzLabel = TIMEZONES.find(t => t.iana === settings.notifyTimezone)?.label ?? settings.notifyTimezone;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Sticky nav bar ── */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: '1px solid rgba(var(--fg-rgb),0.07)', background: 'var(--bg)' }}>
          <button
            onClick={subView !== 'main' ? () => setSubView('main') : goBack}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
          >
            ← {subView !== 'main' ? 'Назад' : 'Закрыть'}
          </button>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            {subView === 'time' ? 'Время уведомления' : subView === 'tz' ? 'Часовой пояс' : 'Настройки'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--accent-green)', fontWeight: 600, opacity: savedToast ? 1 : 0, transition: 'opacity 0.3s' }}>
            Сохранено ✓
          </span>
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 80px' }}>

            {/* ── TIME VIEW ── */}
            {subView === 'time' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {HOURS.map(h => {
                  const active = h === localHour;
                  return (
                    <div key={h} onClick={async () => { await patch({ notifyLocalHour: h }); setSubView('main'); }}
                      style={{ padding: '14px 0', borderRadius: 12, textAlign: 'center', background: active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.05)', color: active ? '#fff' : 'var(--text-sub)', fontSize: 15, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
                    >{pad(h)}:00</div>
                  );
                })}
              </div>
            )}

            {/* ── TZ VIEW ── */}
            {subView === 'tz' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {TIMEZONES.map(tz => {
                  const active = tz.iana === settings.notifyTimezone;
                  return (
                    <div key={tz.iana} onClick={async () => { await patch({ notifyTimezone: tz.iana }); setSubView('main'); }}
                      style={{ padding: '13px 16px', borderRadius: 12, background: active ? 'rgba(124,114,248,0.12)' : 'rgba(var(--fg-rgb),0.03)', color: active ? 'var(--accent)' : 'var(--text-sub)', fontSize: 14, fontWeight: active ? 600 : 400, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >{tz.label}{active && <span>✓</span>}</div>
                  );
                })}
              </div>
            )}

            {/* ── MAIN VIEW ── */}
            {subView === 'main' && (
              <>

                {/* Оформление */}
                <Section label="Оформление">
                  <CardGroup>
                    <SettingRow
                      icon={theme === 'dark' ? '🌙' : '☀️'}
                      title={theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
                      sub={<span onClick={() => setTheme(resetToSystemTheme())} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Авто (по системе) →</span>}
                      right={<Toggle on={theme === 'dark'} onClick={() => setTheme(toggleTheme())} />}
                    />
                    {userRole === 'THERAPIST' && onToggleTherapistMode && (
                      <SettingRow divider
                        icon="👨‍⚕️"
                        title="Режим специалиста"
                        sub={therapistMode ? 'Кабинет терапевта' : 'Режим клиента'}
                        right={<Toggle on={!!therapistMode} onClick={onToggleTherapistMode} />}
                      />
                    )}
                  </CardGroup>
                </Section>

                {/* Имя */}
                <Section label="Имя">
                  <CardGroup>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px' }}>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Твоё имя"
                        maxLength={50}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit' }}
                      />
                      {editName !== (displayName ?? '') && (
                        <button disabled={nameSaving || !editName.trim()}
                          onClick={async () => {
                            const name = editName.trim(); if (!name) return;
                            setNameSaving(true);
                            try { await api.updateName(name); onNameChanged?.(name); setSavedToast(true); setTimeout(() => setSavedToast(false), 1800); }
                            catch {} finally { setNameSaving(false); }
                          }}
                          style={{ background: 'rgba(124,114,248,0.12)', border: 'none', borderRadius: 8, padding: '7px 14px', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                        >{nameSaving ? '...' : 'Сохранить'}</button>
                      )}
                    </div>
                  </CardGroup>
                </Section>

                {/* Уведомления */}
                <Section label="Уведомления" hint="Приходят через Telegram — @SchemaLabBot">
                  <CardGroup>
                    <SettingRow title="Итоги дня" sub="Ежедневный отчёт по потребностям" right={<Toggle on={settings.notifyEnabled} onClick={() => patch({ notifyEnabled: !settings.notifyEnabled })} />} />
                    <SettingRow divider title="Напоминание" sub="Заполнить трекер вечером" right={<Toggle on={!!settings.notifyReminderEnabled} onClick={() => patch({ notifyReminderEnabled: !settings.notifyReminderEnabled })} />} />
                    {(settings.notifyEnabled || settings.notifyReminderEnabled) && (
                      <>
                        <SettingRow divider title="Время" right={<ChevronVal text={`${pad(localHour)}:00`} />} onClick={() => setSubView('time')} />
                        <SettingRow divider title="Часовой пояс" right={<ChevronVal text={tzLabel} small />} onClick={() => setSubView('tz')} />
                      </>
                    )}
                  </CardGroup>
                </Section>

                {/* Мой терапевт (CLIENT) */}
                {userRole !== 'THERAPIST' && (
                  <Section label="Мой терапевт" hint="Терапевт видит трекер и задания. Остальное — на твоё усмотрение.">
                    <CardGroup>
                      {therapyRelation === undefined ? (
                        <div style={{ padding: '16px 18px', color: 'var(--text-faint)', fontSize: 13 }}>Загрузка...</div>
                      ) : therapyRelation?.status === 'active' ? (
                        <div style={{ padding: '16px 18px' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
                            👨‍⚕️ {therapyRelation.partnerName ?? 'Терапевт'} подключён
                          </div>
                          <div style={{ background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                              <div><div style={{ fontSize: 13, fontWeight: 500 }}>Карточки схем и режимов</div><div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Личные карточки и заметки</div></div>
                              <SmallToggle on={!!settings.therapistShareCards} onClick={() => patch({ therapistShareCards: !settings.therapistShareCards })} />
                            </div>
                            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div><div style={{ fontSize: 13, fontWeight: 500 }}>Профиль и схемы YSQ</div><div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Активные схемы и результаты теста</div></div>
                              <SmallToggle on={!!settings.therapistShareProfile} onClick={() => patch({ therapistShareProfile: !settings.therapistShareProfile })} />
                            </div>
                          </div>
                          <button onClick={() => { api.leaveTherapy().then(() => setTherapyRelation(null)).catch(() => {}); }}
                            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '9px 18px', color: 'var(--accent-red)', fontSize: 13, cursor: 'pointer' }}>
                            Отключиться от терапевта
                          </button>
                        </div>
                      ) : (
                        <div style={{ padding: '16px 18px' }}>
                          <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 14, lineHeight: 1.6 }}>
                            Если терапевт выслал ссылку-приглашение — введи код ниже.
                          </p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input value={therapyJoinCode} onChange={e => setTherapyJoinCode(e.target.value.toUpperCase())}
                              placeholder="ABCDEF" maxLength={8}
                              style={{ flex: 1, background: 'rgba(var(--fg-rgb),0.05)', border: `1.5px solid ${therapyJoinError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.12)'}`, borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 15, fontFamily: 'monospace', letterSpacing: 3, outline: 'none' }}
                            />
                            <button onClick={async () => {
                              if (!therapyJoinCode.trim()) return;
                              setTherapyJoinError('');
                              try { await api.joinTherapy(therapyJoinCode.trim()); const rel = await api.getTherapyRelation(); setTherapyRelation(rel); setTherapyJoinCode(''); }
                              catch { setTherapyJoinError('Неверный код'); }
                            }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                              Войти
                            </button>
                          </div>
                          {therapyJoinError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 8 }}>{therapyJoinError}</div>}
                        </div>
                      )}
                    </CardGroup>
                  </Section>
                )}

                {/* Стать психологом (CLIENT, не THERAPIST) */}
                {userRole !== 'THERAPIST' && (
                  <Section label="Роль психолога">
                    <CardGroup>
                      <div style={{ padding: '16px 18px' }}>
                        {therapistReq?.status === 'pending' ? (
                          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                            ⏳ Заявка на рассмотрении. Когда администратор одобрит — придёт уведомление в Telegram.
                          </div>
                        ) : therapistReq?.status === 'approved' ? (
                          <div style={{ fontSize: 13, color: 'var(--accent-green)', lineHeight: 1.6 }}>
                            ✅ Заявка одобрена. Перезайди в приложение чтобы появился кабинет терапевта.
                          </div>
                        ) : !showReqForm ? (
                          <div>
                            {therapistReq?.status === 'rejected' && (
                              <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 12, padding: '10px 12px', background: 'rgba(248,113,113,0.08)', borderRadius: 8 }}>
                                Заявка отклонена{therapistReq.rejectReason ? `: ${therapistReq.rejectReason}` : ''}. Можешь подать снова.
                              </div>
                            )}
                            <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 14 }}>
                              Если ты практикующий специалист — подай заявку. Администратор проверит и откроет доступ к кабинету терапевта.
                            </p>
                            <button onClick={() => setShowReqForm(true)}
                              style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid rgba(var(--fg-rgb),0.15)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                              👨‍⚕️ Подать заявку
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <input value={reqFullName} onChange={e => setReqFullName(e.target.value)} placeholder="ФИО"
                              style={inputStyle} />
                            <textarea value={reqQual} onChange={e => setReqQual(e.target.value)} rows={3}
                              placeholder="Квалификация: образование, направление, опыт, сертификаты"
                              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                            <input value={reqContacts} onChange={e => setReqContacts(e.target.value)} placeholder="Контакты: сайт, @telegram, b17 и т.д."
                              style={inputStyle} />
                            <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)} rows={2}
                              placeholder="Сообщение (необязательно)"
                              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                            {reqError && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{reqError}</div>}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => { setShowReqForm(false); setReqError(''); }}
                                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid rgba(var(--fg-rgb),0.12)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>
                                Отмена
                              </button>
                              <button disabled={reqBusy} onClick={submitTherapistRequest}
                                style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: reqBusy ? 'default' : 'pointer', opacity: reqBusy ? 0.7 : 1 }}>
                                {reqBusy ? 'Отправляю...' : 'Отправить заявку'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardGroup>
                  </Section>
                )}

                {/* Кабинет терапевта (THERAPIST) */}
                {userRole === 'THERAPIST' && (
                  <Section label="Кабинет терапевта">
                    <CardGroup>
                      <SettingRow title="Открыть кабинет" sub="Клиенты, задания, приглашения" onClick={onOpenTherapistCabinet} right={<span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>} />
                      <div style={{ borderTop: '1px solid rgba(var(--fg-rgb),0.06)', padding: '14px 18px' }}>
                        <button onClick={async () => {
                          try { const { url } = await api.createTherapyInvite(); setTherapyInviteUrl(url); try { await navigator.clipboard.writeText(url); } catch {} } catch {}
                        }} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid rgba(var(--fg-rgb),0.15)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>
                          + Создать приглашение клиенту
                        </button>
                        {therapyInviteUrl && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, wordBreak: 'break-all' }}>Скопировано ✓</div>}
                      </div>
                    </CardGroup>
                  </Section>
                )}

                {/* Партнёр */}
                <Section label="Партнёр" hint="Видите индексы дня друг друга — просто число, без деталей">
                  <CardGroup>
                    <div style={{ padding: '16px 18px' }}>
                      {pairLoading && !pairData ? (
                        <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Загрузка...</div>
                      ) : pairData && pairData.partners.length > 0 ? (
                        pairData.partners.map(p => (
                          <div key={p.code} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 6 }}>{p.partnerName ?? 'Друг'} сегодня</div>
                            {p.partnerTodayDone && p.partnerIndex !== null
                              ? <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12 }}>{(p.partnerIndex ?? 0).toFixed(1)}<span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-sub)' }}>/10</span></div>
                              : <div style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 12 }}>Ещё не заполнил</div>
                            }
                            <button onClick={() => { api.leavePair(p.code).catch(() => {}); api.getPair().then(setPairData).catch(() => {}); }}
                              style={{ padding: '7px 14px', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, background: 'rgba(248,113,113,0.06)', color: 'var(--accent-red)', fontSize: 13, cursor: 'pointer' }}>
                              Выйти из пары
                            </button>
                          </div>
                        ))
                      ) : joinView === 'main' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={handleCreateInvite} disabled={pairLoading}
                              style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: pairLoading ? 'default' : 'pointer', opacity: pairLoading ? 0.7 : 1 }}>
                              {pairLoading ? '...' : pairData?.pendingCode ? 'Новая ссылка' : 'Пригласить друга'}
                            </button>
                            <button onClick={() => setJoinView('join')}
                              style={{ padding: '9px 16px', border: '1px solid rgba(var(--fg-rgb),0.14)', borderRadius: 8, background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>
                              Ввести код
                            </button>
                          </div>
                          {pairInviteUrl && (
                            <div style={{ background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 10, padding: '12px 14px' }}>
                              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 6 }}>Отправь другу:</div>
                              <div style={{ fontSize: 12, color: 'var(--text-sub)', wordBreak: 'break-all', marginBottom: 10, userSelect: 'all', fontFamily: 'monospace' }}>{pairInviteUrl}</div>
                              <button onClick={async () => { try { await navigator.clipboard.writeText(pairInviteUrl); setPairInviteCopied(true); setTimeout(() => setPairInviteCopied(false), 2000); } catch {} }}
                                style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: pairInviteCopied ? 'rgba(52,211,153,0.12)' : 'rgba(var(--fg-rgb),0.08)', color: pairInviteCopied ? 'var(--accent-green)' : 'var(--text-sub)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                {pairInviteCopied ? '✓ Скопировано' : 'Скопировать ссылку'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <button onClick={() => setJoinView('main')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, cursor: 'pointer', padding: '0 0 14px', fontFamily: 'inherit' }}>← Назад</button>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Код"
                              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(var(--fg-rgb),0.05)', border: `1.5px solid ${joinError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.1)'}`, color: 'var(--text)', fontSize: 15, fontFamily: 'monospace', outline: 'none', letterSpacing: 4, textAlign: 'center' }}
                            />
                            <button onClick={handleJoin} disabled={!joinCode.trim() || pairLoading}
                              style={{ padding: '10px 16px', border: 'none', borderRadius: 10, background: joinCode.trim() ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.1)', color: joinCode.trim() ? '#fff' : 'var(--text-faint)', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                              Войти
                            </button>
                          </div>
                          {joinError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 6 }}>Код не найден или уже использован</div>}
                        </div>
                      )}
                    </div>
                  </CardGroup>
                </Section>

                {/* Поделиться */}
                <Section label="Поделиться">
                  <CardGroup>
                    <SettingRow icon="🔗" title="Пригласить друга" sub="Поделиться ссылкой на бота" onClick={async () => {
                      const text = 'Трекер потребностей – отслеживай своё состояние каждый день. t.me/SchemaLabBot';
                      try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); } catch { try { await navigator.clipboard.writeText(text); } catch {} }
                    }} />
                    <SettingRow divider icon="📤" title="Сводка для терапевта" sub="Данные за 30 дней" onClick={async () => {
                      const { text } = await api.getExport();
                      let shared = false;
                      try { if (navigator.share) { await navigator.share({ text }); shared = true; } } catch {}
                      if (!shared) { try { await navigator.clipboard.writeText(text); } catch {} setExportText(text); }
                    }} />
                  </CardGroup>
                </Section>

                {/* О приложении */}
                <Section label="О приложении">
                  <div className="card-elevated" style={{ padding: '24px' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 10 }}>СхемаЛаб</div>
                    <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 20px' }}>
                      Инструмент самопознания на основе схема-терапии: трекер потребностей, дневники схем и режимов, тесты, практики и пространство для работы с терапевтом.
                    </p>
                    <div style={{ height: 1, background: 'rgba(var(--fg-rgb),0.07)', marginBottom: 20 }} />
                    <div className="eyebrow" style={{ marginBottom: 12 }}>Об авторе</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <a href="https://t.me/SchemeHappens" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-sub)', textDecoration: 'none' }}>
                        Канал о схема-терапии → <span style={{ color: 'var(--accent)' }}>@SchemeHappens</span>
                      </a>
                      <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-sub)', textDecoration: 'none' }}>
                        Записаться на сессию → <span style={{ color: 'var(--accent)' }}>@kotlarewski</span>
                      </a>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 20 }}>
                      Разработано для образовательных целей. Не является медицинским или психологическим сервисом.
                    </div>
                  </div>
                </Section>

                {/* Данные */}
                <Section label="Данные">
                  <CardGroup>
                    <SettingRow icon="🔒" title="Конфиденциальность" sub="Что и как хранится" onClick={() => setShowPrivacy(true)} />
                    <SettingRow divider icon="🗑" title="Удалить все данные" color="var(--accent-red)" onClick={() => { setDeleteConfirm(false); setShowDeleteSheet(true); }} />
                  </CardGroup>
                </Section>

              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Export overlay ── */}
      {exportText && (
        <InfoModal onClose={() => { setExportText(null); setExportCopied(false); }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Сводка для терапевта</div>
          <pre style={{ fontSize: 11, color: 'var(--text-sub)', lineHeight: 1.6, background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 10, padding: '12px 14px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 14, userSelect: 'all', fontFamily: 'monospace' }}>
            {exportText}
          </pre>
          <button onClick={async () => { try { await navigator.clipboard.writeText(exportText); setExportCopied(true); setTimeout(() => setExportCopied(false), 2000); } catch {} }}
            style={{ width: '100%', padding: '13px 0', border: 'none', borderRadius: 12, background: exportCopied ? 'rgba(52,211,153,0.12)' : 'rgba(var(--fg-rgb),0.08)', color: exportCopied ? 'var(--accent-green)' : 'var(--text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {exportCopied ? '✓ Скопировано' : 'Скопировать'}
          </button>
        </InfoModal>
      )}

      {/* ── Privacy ── */}
      {showPrivacy && (
        <InfoModal onClose={() => setShowPrivacy(false)}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Данные и конфиденциальность</div>
          {[
            { title: 'Что хранится', text: 'Дневник, оценки, заметки, практики, результаты тестов — всё привязано к аккаунту и доступно с любого устройства.' },
            { title: 'Передача третьим лицам', text: 'Данные не продаются и не передаются. Никогда.' },
          ].map(b => (
            <div key={b.title} style={{ marginBottom: 10, background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{b.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>{b.text}</div>
            </div>
          ))}
          {(!!localStorage.getItem(YSQ_PROGRESS_KEY) || !!localStorage.getItem(YSQ_RESULT_KEY)) && (
            <button onClick={() => { localStorage.removeItem(YSQ_PROGRESS_KEY); localStorage.removeItem(YSQ_RESULT_KEY); api.deleteYsqResult().catch(() => {}); setShowPrivacy(false); }}
              style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 10 }}>
              Удалить результаты теста YSQ-R
            </button>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6, textAlign: 'center' }}>Разработано для образовательных целей. Не является медицинским или психологическим сервисом.</div>
        </InfoModal>
      )}

      {/* ── Delete ── */}
      {showDeleteSheet && (
        <InfoModal onClose={() => { setShowDeleteSheet(false); setDeleteConfirm(false); }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>Удалить все данные</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 20 }}>
            Дневники, оценки, практики, тесты, заметки, задания — всё удалится с сервера. Необратимо.
          </div>
          {!deleteConfirm ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteSheet(false)} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: '1px solid rgba(var(--fg-rgb),0.1)', background: 'transparent', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer' }}>Отмена</button>
              <button onClick={() => setDeleteConfirm(true)} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Удалить</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, color: 'var(--accent-red)', textAlign: 'center', marginBottom: 16, fontWeight: 500 }}>Точно? Восстановить невозможно.</div>
              <button disabled={deleting} onClick={async () => {
                setDeleting(true);
                try { await api.deleteAllUserData(); const t = localStorage.getItem('app_theme'); const cc = localStorage.getItem('cookie_consent'); localStorage.clear(); sessionStorage.clear(); if (t) localStorage.setItem('app_theme', t); if (cc) localStorage.setItem('cookie_consent', cc); window.location.reload(); }
                catch { setDeleting(false); setDeleteConfirm(false); }
              }} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontSize: 15, fontWeight: 700, cursor: deleting ? 'default' : 'pointer' }}>
                {deleting ? 'Удаляем...' : 'Да, удалить всё навсегда'}
              </button>
            </div>
          )}
        </InfoModal>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  background: 'rgba(var(--fg-rgb),0.05)', border: '1.5px solid rgba(var(--fg-rgb),0.1)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none',
};

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="eyebrow" style={{ marginBottom: hint ? 4 : 10 }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>
  );
}

function CardGroup({ children }: { children: React.ReactNode }) {
  return <div className="card-elevated" style={{ overflow: 'hidden' }}>{children}</div>;
}

function SettingRow({ icon, title, sub, right, onClick, divider, color }: {
  icon?: string; title: string; sub?: React.ReactNode; right?: React.ReactNode;
  onClick?: () => void; divider?: boolean; color?: string;
}) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
      cursor: onClick ? 'pointer' : 'default',
      borderTop: divider ? '1px solid rgba(var(--fg-rgb),0.06)' : undefined,
    }}>
      {icon && <span style={{ fontSize: 18, width: 26, textAlign: 'center', flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: color ?? 'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {right ?? (onClick && <span style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}>›</span>)}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, background: on ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--bg)', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
    </div>
  );
}

function SmallToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ width: 38, height: 22, borderRadius: 11, flexShrink: 0, background: on ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  );
}

function ChevronVal({ text, small }: { text: string; small?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: small ? 12 : 14, color: 'var(--text-sub)', textAlign: 'right', maxWidth: 180 }}>{text}</span>
      <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
    </div>
  );
}

function InfoModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '24px 24px 48px', width: '100%', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--fg-rgb),0.12)', margin: '0 auto 20px' }} />
        {children}
      </div>
    </div>
  );
}
