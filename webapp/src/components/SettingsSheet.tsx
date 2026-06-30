import { useState, useEffect } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { DonateSheet } from './DonateSheet';
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
  const [showDonate, setShowDonate] = useState(false);
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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navItems = [
    { id: 's-appearance', label: 'Оформление' },
    { id: 's-name', label: 'Имя' },
    { id: 's-notifications', label: 'Уведомления' },
    ...(userRole !== 'THERAPIST' ? [
      { id: 's-therapist', label: 'Мой терапевт' },
      { id: 's-specialist', label: 'Специалист' },
    ] : [
      { id: 's-cabinet', label: 'Кабинет' },
    ]),
    { id: 's-partner', label: 'Партнёр' },
    { id: 's-share', label: 'Поделиться' },
    { id: 's-about', label: 'О приложении' },
    { id: 's-data', label: 'Данные' },
  ];

  if (!settings) {
    return (
      <div className="settings-overlay" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader minHeight="40vh" />
      </div>
    );
  }

  const localHour = settings.notifyLocalHour;
  const tzLabel = TIMEZONES.find(t => t.iana === settings.notifyTimezone)?.label ?? settings.notifyTimezone;

  return (
    <>
      <div className="settings-overlay" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 32px', height: 52, borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
          <button
            onClick={subView !== 'main' ? () => setSubView('main') : goBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
          >
            ← {subView !== 'main' ? 'Назад' : 'Закрыть'}
          </button>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {subView === 'time' ? 'Время уведомления' : subView === 'tz' ? 'Часовой пояс' : 'Настройки'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--accent-green)', fontWeight: 500, opacity: savedToast ? 1 : 0, transition: 'opacity 0.3s' }}>
            Сохранено ✓
          </span>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* Left nav */}
          {subView === 'main' && (
            <div className="settings-sidenav">
              {navItems.map(n => (
                <button key={n.id} onClick={() => scrollTo(n.id)} className="settings-sidenav-item">
                  {n.label}
                </button>
              ))}
            </div>
          )}

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="settings-content-inner" style={{ padding: subView !== 'main' ? '32px 48px 80px' : '0 48px 80px' }}>

              {/* ── TIME VIEW ── */}
              {subView === 'time' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {HOURS.map(h => {
                    const active = h === localHour;
                    return (
                      <div key={h} onClick={async () => { await patch({ notifyLocalHour: h }); setSubView('main'); }}
                        style={{ padding: '14px 0', borderRadius: 8, textAlign: 'center', background: active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.05)', color: active ? '#fff' : 'var(--text-sub)', fontSize: 15, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
                      >{pad(h)}:00</div>
                    );
                  })}
                </div>
              )}

              {/* ── TZ VIEW ── */}
              {subView === 'tz' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {TIMEZONES.map(tz => {
                    const active = tz.iana === settings.notifyTimezone;
                    return (
                      <div key={tz.iana} onClick={async () => { await patch({ notifyTimezone: tz.iana }); setSubView('main'); }}
                        style={{ padding: '12px 14px', borderRadius: 7, background: active ? 'rgba(124,114,248,0.08)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-sub)', fontSize: 14, fontWeight: active ? 600 : 400, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >{tz.label}{active && <span>✓</span>}</div>
                    );
                  })}
                </div>
              )}

              {/* ── MAIN VIEW ── */}
              {subView === 'main' && (<>

                {/* Оформление */}
                <SHead id="s-appearance" label="Оформление" />
                <SRow
                  title={theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
                  sub={<span onClick={e => { e.stopPropagation(); setTheme(resetToSystemTheme()); }} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Авто (по системе) →</span>}
                  right={<Toggle on={theme === 'dark'} onClick={() => setTheme(toggleTheme())} />}
                />
                {userRole === 'THERAPIST' && onToggleTherapistMode && (
                  <SRow
                    title="Режим специалиста"
                    sub={therapistMode ? 'Кабинет терапевта' : 'Режим клиента'}
                    right={<Toggle on={!!therapistMode} onClick={onToggleTherapistMode} />}
                  />
                )}

                {/* Имя */}
                <SHead id="s-name" label="Имя" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Твоё имя"
                    maxLength={50}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }}
                  />
                  {editName !== (displayName ?? '') && (
                    <button disabled={nameSaving || !editName.trim()}
                      onClick={async () => {
                        const name = editName.trim(); if (!name) return;
                        setNameSaving(true);
                        try { await api.updateName(name); onNameChanged?.(name); setSavedToast(true); setTimeout(() => setSavedToast(false), 1800); }
                        catch {} finally { setNameSaving(false); }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit', flexShrink: 0 }}
                    >{nameSaving ? '...' : 'Сохранить'}</button>
                  )}
                </div>

                {/* Уведомления */}
                <SHead id="s-notifications" label="Уведомления" hint="Приходят через Telegram — @SchemaLabBot" />
                <SRow title="Итоги дня" sub="Ежедневный отчёт по потребностям" right={<Toggle on={settings.notifyEnabled} onClick={() => patch({ notifyEnabled: !settings.notifyEnabled })} />} />
                <SRow title="Напоминание" sub="Заполнить трекер вечером" right={<Toggle on={!!settings.notifyReminderEnabled} onClick={() => patch({ notifyReminderEnabled: !settings.notifyReminderEnabled })} />} />
                {(settings.notifyEnabled || settings.notifyReminderEnabled) && (<>
                  <SRow title="Время" right={<ChevronVal text={`${pad(localHour)}:00`} />} onClick={() => setSubView('time')} />
                  <SRow title="Часовой пояс" right={<ChevronVal text={tzLabel} small />} onClick={() => setSubView('tz')} />
                </>)}

                {/* Мой терапевт */}
                {userRole !== 'THERAPIST' && (<>
                  <SHead id="s-therapist" label="Мой терапевт" hint="Терапевт видит трекер и задания. Остальное — на твоё усмотрение." />
                  {therapyRelation === undefined ? (
                    <SRow title="Загрузка..." />
                  ) : therapyRelation?.status === 'active' ? (
                    <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                        {therapyRelation.partnerName ?? 'Терапевт'} подключён
                      </div>
                      <SRow title="Карточки схем и режимов" sub="Личные карточки и заметки" right={<SmallToggle on={!!settings.therapistShareCards} onClick={() => patch({ therapistShareCards: !settings.therapistShareCards })} />} />
                      <SRow title="Профиль и схемы YSQ" sub="Активные схемы и результаты теста" right={<SmallToggle on={!!settings.therapistShareProfile} onClick={() => patch({ therapistShareProfile: !settings.therapistShareProfile })} />} />
                      <button onClick={() => { api.leaveTherapy().then(() => setTherapyRelation(null)).catch(() => {}); }}
                        style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                        Отключиться от терапевта
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: '0 0 12px', lineHeight: 1.6 }}>
                        Если терапевт выслал ссылку-приглашение — введи код ниже.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={therapyJoinCode} onChange={e => setTherapyJoinCode(e.target.value.toUpperCase())}
                          placeholder="ABCDEF" maxLength={8}
                          style={{ flex: 1, background: 'rgba(var(--fg-rgb),0.05)', border: `1px solid ${therapyJoinError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.1)'}`, borderRadius: 7, padding: '8px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'monospace', letterSpacing: 3, outline: 'none' }}
                        />
                        <button onClick={async () => {
                          if (!therapyJoinCode.trim()) return;
                          setTherapyJoinError('');
                          try { await api.joinTherapy(therapyJoinCode.trim()); const rel = await api.getTherapyRelation(); setTherapyRelation(rel); setTherapyJoinCode(''); }
                          catch { setTherapyJoinError('Неверный код'); }
                        }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 7, padding: '8px 16px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Войти
                        </button>
                      </div>
                      {therapyJoinError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 6 }}>{therapyJoinError}</div>}
                    </div>
                  )}
                </>)}

                {/* Стать специалистом */}
                {userRole !== 'THERAPIST' && (<>
                  <SHead id="s-specialist" label="Стать специалистом" />
                  <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
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
                          <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 12 }}>
                            Заявка отклонена{therapistReq.rejectReason ? `: ${therapistReq.rejectReason}` : ''}. Можешь подать снова.
                          </div>
                        )}
                        <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, margin: '0 0 12px' }}>
                          Если ты практикующий специалист — подай заявку. Администратор проверит и откроет доступ к кабинету.
                        </p>
                        <button onClick={() => setShowReqForm(true)}
                          style={{ background: 'none', border: '1px solid rgba(var(--fg-rgb),0.15)', borderRadius: 7, padding: '7px 14px', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Подать заявку
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input value={reqFullName} onChange={e => setReqFullName(e.target.value)} placeholder="ФИО" style={inputStyle} />
                        <textarea value={reqQual} onChange={e => setReqQual(e.target.value)} rows={3}
                          placeholder="Квалификация: образование, направление, опыт, сертификаты"
                          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                        <input value={reqContacts} onChange={e => setReqContacts(e.target.value)} placeholder="Контакты: сайт, @telegram, b17 и т.д." style={inputStyle} />
                        <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)} rows={2}
                          placeholder="Сообщение (необязательно)"
                          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                        {reqError && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{reqError}</div>}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setShowReqForm(false); setReqError(''); }}
                            style={{ flex: 1, padding: '10px 0', borderRadius: 7, border: '1px solid rgba(var(--fg-rgb),0.12)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Отмена
                          </button>
                          <button disabled={reqBusy} onClick={submitTherapistRequest}
                            style={{ flex: 2, padding: '10px 0', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: reqBusy ? 'default' : 'pointer', opacity: reqBusy ? 0.7 : 1, fontFamily: 'inherit' }}>
                            {reqBusy ? 'Отправляю...' : 'Отправить заявку'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>)}

                {/* Кабинет терапевта */}
                {userRole === 'THERAPIST' && (<>
                  <SHead id="s-cabinet" label="Кабинет терапевта" />
                  <SRow title="Открыть кабинет" sub="Клиенты, задания, приглашения" onClick={onOpenTherapistCabinet} />
                  <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                    <button onClick={async () => {
                      try { const { url } = await api.createTherapyInvite(); setTherapyInviteUrl(url); try { await navigator.clipboard.writeText(url); } catch {} } catch {}
                    }} style={{ background: 'none', border: '1px solid rgba(var(--fg-rgb),0.15)', borderRadius: 7, padding: '7px 14px', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      + Создать приглашение клиенту
                    </button>
                    {therapyInviteUrl && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>Скопировано ✓</div>}
                  </div>
                </>)}

                {/* Партнёр */}
                <SHead id="s-partner" label="Партнёр" hint="Видите индексы дня друг друга — просто число, без деталей" />
                <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                  {pairLoading && !pairData ? (
                    <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Загрузка...</div>
                  ) : pairData && pairData.partners.length > 0 ? (
                    pairData.partners.map(p => (
                      <div key={p.code} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 4 }}>{p.partnerName ?? 'Друг'} сегодня</div>
                        {p.partnerTodayDone && p.partnerIndex !== null
                          ? <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 10 }}>{(p.partnerIndex ?? 0).toFixed(1)}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-sub)' }}>/10</span></div>
                          : <div style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 10 }}>Ещё не заполнил</div>
                        }
                        <button onClick={() => { api.leavePair(p.code).catch(() => {}); api.getPair().then(setPairData).catch(() => {}); }}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                          Выйти из пары
                        </button>
                      </div>
                    ))
                  ) : joinView === 'main' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleCreateInvite} disabled={pairLoading}
                          style={{ padding: '8px 16px', border: 'none', borderRadius: 7, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: pairLoading ? 'default' : 'pointer', opacity: pairLoading ? 0.7 : 1, fontFamily: 'inherit' }}>
                          {pairLoading ? '...' : pairData?.pendingCode ? 'Новая ссылка' : 'Пригласить друга'}
                        </button>
                        <button onClick={() => setJoinView('join')}
                          style={{ padding: '8px 16px', border: '1px solid rgba(var(--fg-rgb),0.14)', borderRadius: 7, background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Ввести код
                        </button>
                      </div>
                      {pairInviteUrl && (
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4 }}>Отправь другу:</div>
                          <div style={{ fontSize: 12, color: 'var(--text-sub)', wordBreak: 'break-all', marginBottom: 8, userSelect: 'all', fontFamily: 'monospace' }}>{pairInviteUrl}</div>
                          <button onClick={async () => { try { await navigator.clipboard.writeText(pairInviteUrl); setPairInviteCopied(true); setTimeout(() => setPairInviteCopied(false), 2000); } catch {} }}
                            style={{ background: 'none', border: 'none', color: pairInviteCopied ? 'var(--accent-green)' : 'var(--accent)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                            {pairInviteCopied ? '✓ Скопировано' : 'Скопировать ссылку'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <button onClick={() => setJoinView('main')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, cursor: 'pointer', padding: '0 0 12px', fontFamily: 'inherit', display: 'block' }}>← Назад</button>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Код"
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 7, background: 'rgba(var(--fg-rgb),0.05)', border: `1px solid ${joinError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.1)'}`, color: 'var(--text)', fontSize: 15, fontFamily: 'monospace', outline: 'none', letterSpacing: 4, textAlign: 'center' }}
                        />
                        <button onClick={handleJoin} disabled={!joinCode.trim() || pairLoading}
                          style={{ padding: '8px 16px', border: 'none', borderRadius: 7, background: joinCode.trim() ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.1)', color: joinCode.trim() ? '#fff' : 'var(--text-faint)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Войти
                        </button>
                      </div>
                      {joinError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 6 }}>Код не найден или уже использован</div>}
                    </div>
                  )}
                </div>

                {/* Поделиться */}
                <SHead id="s-share" label="Поделиться" />
                <SRow title="Пригласить друга" sub="Поделиться ссылкой на бота" onClick={async () => {
                  const text = 'Трекер потребностей – отслеживай своё состояние каждый день. t.me/SchemaLabBot';
                  try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); } catch { try { await navigator.clipboard.writeText(text); } catch {} }
                }} />
                <SRow title="Сводка для терапевта" sub="Данные за 30 дней" onClick={async () => {
                  const { text } = await api.getExport();
                  let shared = false;
                  try { if (navigator.share) { await navigator.share({ text }); shared = true; } } catch {}
                  if (!shared) { try { await navigator.clipboard.writeText(text); } catch {} setExportText(text); }
                }} />

                {/* О приложении */}
                <SHead id="s-about" label="О приложении" />
                <div style={{ padding: '20px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 14px' }}>
                    Инструмент самопознания на основе схема-терапии: трекер потребностей, дневники схем и режимов, тесты, практики и пространство для работы с терапевтом.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <a href="https://t.me/SchemeHappens" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-sub)', textDecoration: 'none' }}>
                      Канал о схема-терапии → <span style={{ color: 'var(--accent)' }}>@SchemeHappens</span>
                    </a>
                    <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-sub)', textDecoration: 'none' }}>
                      Записаться на сессию → <span style={{ color: 'var(--accent)' }}>@kotlarewski</span>
                    </a>
                    <a href="/subscribe" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-sub)', textDecoration: 'none' }}>
                      Подписка на проект → <span style={{ color: 'var(--accent)' }}>оформить ★</span>
                    </a>
                    <button onClick={() => setShowDonate(true)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, fontSize: 14, color: 'var(--text-sub)', fontFamily: 'inherit', cursor: 'pointer' }}>
                      Поддержать проект → <span style={{ color: 'var(--accent)' }}>разовый донат 💛</span>
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 14 }}>
                    Разработано для образовательных целей. Не является медицинским или психологическим сервисом.
                  </div>
                </div>

                {/* Данные */}
                <SHead id="s-data" label="Данные" />
                <SRow title="Конфиденциальность" sub="Что и как хранится" onClick={() => setShowPrivacy(true)} />
                <SRow title="Удалить все данные" danger onClick={() => { setDeleteConfirm(false); setShowDeleteSheet(true); }} />

              </>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Export modal ── */}
      {exportText && (
        <InfoModal onClose={() => { setExportText(null); setExportCopied(false); }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Сводка для терапевта</div>
          <pre style={{ fontSize: 11, color: 'var(--text-sub)', lineHeight: 1.6, background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 14, userSelect: 'all', fontFamily: 'monospace' }}>
            {exportText}
          </pre>
          <button onClick={async () => { try { await navigator.clipboard.writeText(exportText); setExportCopied(true); setTimeout(() => setExportCopied(false), 2000); } catch {} }}
            style={{ width: '100%', padding: '12px 0', border: 'none', borderRadius: 10, background: exportCopied ? 'rgba(52,211,153,0.12)' : 'rgba(var(--fg-rgb),0.08)', color: exportCopied ? 'var(--accent-green)' : 'var(--text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {exportCopied ? '✓ Скопировано' : 'Скопировать'}
          </button>
        </InfoModal>
      )}

      {/* ── Privacy modal ── */}
      {showPrivacy && (
        <InfoModal onClose={() => setShowPrivacy(false)}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Данные и конфиденциальность</div>
          {[
            { title: 'Что хранится', text: 'Дневник, оценки, заметки, практики, результаты тестов — всё привязано к аккаунту и доступно с любого устройства.' },
            { title: 'Передача третьим лицам', text: 'Данные не продаются и не передаются. Никогда.' },
          ].map(b => (
            <div key={b.title} style={{ marginBottom: 10, background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{b.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>{b.text}</div>
            </div>
          ))}
          {(!!localStorage.getItem(YSQ_PROGRESS_KEY) || !!localStorage.getItem(YSQ_RESULT_KEY)) && (
            <button onClick={() => { localStorage.removeItem(YSQ_PROGRESS_KEY); localStorage.removeItem(YSQ_RESULT_KEY); api.deleteYsqResult().catch(() => {}); setShowPrivacy(false); }}
              style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 10, fontFamily: 'inherit' }}>
              Удалить результаты теста YSQ-R
            </button>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6, textAlign: 'center' }}>Разработано для образовательных целей.</div>
        </InfoModal>
      )}

      {showDonate && <DonateSheet onClose={() => setShowDonate(false)} source="app" />}

      {/* ── Delete modal ── */}
      {showDeleteSheet && (
        <InfoModal onClose={() => { setShowDeleteSheet(false); setDeleteConfirm(false); }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>Удалить все данные</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 20 }}>
            Дневники, оценки, практики, тесты, заметки, задания — всё удалится с сервера. Необратимо.
          </div>
          {!deleteConfirm ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteSheet(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid rgba(var(--fg-rgb),0.1)', background: 'transparent', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
              <button onClick={() => setDeleteConfirm(true)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, color: 'var(--accent-red)', textAlign: 'center', marginBottom: 16, fontWeight: 500 }}>Точно? Восстановить невозможно.</div>
              <button disabled={deleting} onClick={async () => {
                setDeleting(true);
                try { await api.deleteAllUserData(); const t = localStorage.getItem('app_theme'); const cc = localStorage.getItem('cookie_consent'); localStorage.clear(); sessionStorage.clear(); if (t) localStorage.setItem('app_theme', t); if (cc) localStorage.setItem('cookie_consent', cc); window.location.reload(); }
                catch { setDeleting(false); setDeleteConfirm(false); }
              }} style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontSize: 15, fontWeight: 700, cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit' }}>
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
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)',
  borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none',
};

function SHead({ id, label, hint }: { id: string; label: string; hint?: string }) {
  return (
    <div id={id} style={{ paddingTop: 40, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
      <div className="eyebrow">{label}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function SRow({ title, sub, right, onClick, danger }: {
  title: string; sub?: React.ReactNode; right?: React.ReactNode;
  onClick?: () => void; danger?: boolean;
}) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '13px 0',
      borderBottom: '1px solid rgba(var(--fg-rgb),0.06)',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: danger ? 'var(--accent-red)' : 'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {right ?? (onClick && <span style={{ color: 'var(--text-faint)', fontSize: 16, flexShrink: 0 }}>›</span>)}
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
      <span style={{ fontSize: small ? 12 : 14, color: 'var(--text-sub)', textAlign: 'right', maxWidth: 200 }}>{text}</span>
      <span style={{ color: 'var(--text-faint)', fontSize: 16 }}>›</span>
    </div>
  );
}

function InfoModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="settings-modal" onClick={onClose}>
      <div className="settings-modal-box" onClick={e => e.stopPropagation()}>
        <div className="settings-modal-handle" />
        {children}
      </div>
    </div>
  );
}
