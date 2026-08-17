import { useState, useEffect } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api } from '../api';
import type { UserSettings } from '../api';
import { Loader } from './Loader';
import { useSetAddressForm, useTr } from '../utils/addressForm';
import { useCopyToClipboard } from '../../../shared/src/utils/useCopyToClipboard';
import { botHandle, botShortUrl } from '../utils/botConfig';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { ExportSummaryModal } from './settingsSheet/ExportSummaryModal';
import { appInviteShare, pairInviteShare } from '../../../shared/src/share/cards/inviteShare';
import {
  TIMEZONES,
  HOURS,
  FREQ_LABELS,
  QUIET_PRESETS,
  pad,
  quietLabel,
  hourInQuiet,
} from '../../../shared/src/settings/constants';
import { SHead, SRow, Toggle, SmallToggle, ChevronVal } from './settingsSheet/ui';
import { usePairSettings } from './settingsSheet/usePairSettings';
import { useTherapyRelationSettings } from './settingsSheet/useTherapyRelationSettings';
import { AppearanceSection } from './settingsSheet/AppearanceSection';
import { BecomeTherapistSection } from './settingsSheet/BecomeTherapistSection';
import { DataSection } from './settingsSheet/DataSection';


// Дефолты на случай, если api.getSettings() отказал — экран не должен
// зависнуть на Loader, показываем безопасные значения.
const DEFAULT_SETTINGS: UserSettings = {
  notifyEnabled: false, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: false, pairCardDismissed: false, mySchemaIds: [], myModeIds: [],
  therapistShareCards: true, therapistShareProfile: true,
};

interface Props {
  onClose: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  displayName?: string | null;
  onNameChanged?: (name: string) => void;
  onOpenTherapistCabinet?: () => void;
  therapistMode?: boolean;
  onToggleTherapistMode?: () => void;
  onResignTherapist?: () => Promise<void> | void;
}

export function SettingsSheet({ onClose, userRole, displayName, onNameChanged, onOpenTherapistCabinet, therapistMode, onToggleTherapistMode, onResignTherapist }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [subView, setSubView] = useState<'main' | 'time' | 'tz' | 'freq' | 'quiet'>('main');
  const [settings, setSettings]     = useState<UserSettings | null>(null);
  const pair = usePairSettings(userRole);
  const {
    pairData, pairLoading, pairLoadError, pairInviteUrl,
    joinCode, setJoinCode, joinView, setJoinView, joinError, leaveError: leavePairError,
    handleCreateInvite, handleJoin, leavePair, retryLoad: retryPairLoad,
  } = pair;
  const pairInviteCopy = useCopyToClipboard();
  const [exportText, setExportText] = useState<string | null>(null);
  // Сводка собирается на сервере: сеть может отвалиться. Без этого состояния
  // отказ выглядел как «ничего не произошло» — обработчик падал
  // необработанным промисом, и пользователь не знал, ждать ему или нет.
  const [exportError, setExportError] = useState(false);
  const [appInvite, setAppInvite] = useState(false);
  const [pairShare, setPairShare] = useState<{ code: string; url: string } | null>(null);
  // Авто-копия при открытии сводки — свой инстанс: иначе она подсвечивала бы
  // кнопку «Скопировать» в модалке, которую человек ещё не нажимал.
  const exportAutoCopy = useCopyToClipboard();
  const [savedToast, setSavedToast] = useState(false); const [saveError, setSaveError] = useState(false); // «Сохранено» раньше шло даже при отказе api
  const {
    therapyRelation, therapyJoinCode, setTherapyJoinCode, therapyJoinError,
    leaveTherapyError, therapyInviteUrl, inviteCopied, inviteError,
    leaveTherapy, joinTherapy, createInvite,
  } = useTherapyRelationSettings(userRole);
  const [editName, setEditName] = useState(displayName ?? '');
  const [nameSaving, setNameSaving] = useState(false); const [nameError, setNameError] = useState(false); // отказ раньше не был виден
  const setAddressForm = useSetAddressForm();

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  async function patch(update: Partial<UserSettings>) {
    if (!settings) return;
    const prev = settings; setSettings(s => s ? { ...s, ...update } : s);
    try { await api.updateSettings(update); setSavedToast(true); setTimeout(() => setSavedToast(false), 1800); }
    catch { setSettings(prev); setSaveError(true); setTimeout(() => setSaveError(false), 2400); }
  }

  // Карточка с кодом — та же, что в мини-аппе (правило №3), вместо голого
  // текста: пользователь видит превью и делится картинкой.
  async function createInviteAndShare() {
    const r = await handleCreateInvite();
    if (r) setPairShare(r);
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
            {subView === 'time' ? 'Время уведомления' : subView === 'tz' ? 'Часовой пояс' : subView === 'freq' ? 'Частота напоминаний' : subView === 'quiet' ? 'Тихие часы' : 'Настройки'}
          </span>
          <span style={{ fontSize: 13, color: saveError ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 500, opacity: savedToast || saveError ? 1 : 0, transition: 'opacity 0.3s' }}>
            {saveError ? 'Не сохранилось' : 'Сохранено ✓'}
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
                        role="button" tabIndex={0}
                        onKeyDown={async e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await patch({ notifyLocalHour: h }); setSubView('main'); } }}
                        style={{ padding: '14px 0', borderRadius: 8, textAlign: 'center', background: active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.05)', color: active ? '#fff' : 'var(--text-sub)', fontSize: 15, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
                      >{pad(h)}:00</div>
                    );
                  })}
                </div>
              )}

              {/* ── FREQ VIEW ── */}
              {subView === 'freq' && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 14 }}>
                    Если напоминания будут оставаться без ответа, бот сам начнёт писать реже — а когда записи вернутся, вернётся к выбранной частоте.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {FREQ_LABELS.map((label, i) => {
                      const active = i === (settings.notifyFrequency ?? 0);
                      return (
                        <div key={i} onClick={async () => { await patch({ notifyFrequency: i }); setSubView('main'); }}
                          role="button" tabIndex={0}
                          onKeyDown={async e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await patch({ notifyFrequency: i }); setSubView('main'); } }}
                          style={{ padding: '12px 14px', borderRadius: 7, background: active ? 'rgba(124,114,248,0.08)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-sub)', fontSize: 14, fontWeight: active ? 600 : 400, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >{label}{active && <span>✓</span>}</div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── QUIET VIEW ── */}
              {subView === 'quiet' && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 14 }}>
                    В тихие часы бот не пишет вообще — всё, что накопится, придёт утром.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {QUIET_PRESETS.map(p => {
                      const active = p.start === (settings.notifyQuietStart ?? 22) && p.end === (settings.notifyQuietEnd ?? 8);
                      return (
                        <div key={p.label} onClick={async () => { await patch({ notifyQuietStart: p.start, notifyQuietEnd: p.end }); setSubView('main'); }}
                          role="button" tabIndex={0}
                          onKeyDown={async e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await patch({ notifyQuietStart: p.start, notifyQuietEnd: p.end }); setSubView('main'); } }}
                          style={{ padding: '12px 14px', borderRadius: 7, background: active ? 'rgba(124,114,248,0.08)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-sub)', fontSize: 14, fontWeight: active ? 600 : 400, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >{p.label}{active && <span>✓</span>}</div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── TZ VIEW ── */}
              {subView === 'tz' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {TIMEZONES.map(tz => {
                    const active = tz.iana === settings.notifyTimezone;
                    return (
                      <div key={tz.iana} onClick={async () => { await patch({ notifyTimezone: tz.iana }); setSubView('main'); }}
                        role="button" tabIndex={0}
                        onKeyDown={async e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await patch({ notifyTimezone: tz.iana }); setSubView('main'); } }}
                        style={{ padding: '12px 14px', borderRadius: 7, background: active ? 'rgba(124,114,248,0.08)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-sub)', fontSize: 14, fontWeight: active ? 600 : 400, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >{tz.label}{active && <span>✓</span>}</div>
                    );
                  })}
                </div>
              )}

              {/* ── MAIN VIEW ── */}
              {subView === 'main' && (<>

                {/* Оформление */}
                <AppearanceSection
                  userRole={userRole}
                  therapistMode={therapistMode}
                  onToggleTherapistMode={onToggleTherapistMode}
                  onResignTherapist={onResignTherapist}
                  onSaved={() => { setSavedToast(true); setTimeout(() => setSavedToast(false), 1800); }}
                />

                {/* Имя */}
                <SHead id="s-name" label="Имя" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder={tr('Твоё имя', 'Ваше имя')}
                    maxLength={50}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }}
                  />
                  {editName !== (displayName ?? '') && (
                    <button disabled={nameSaving || !editName.trim()}
                      onClick={async () => {
                        const name = editName.trim(); if (!name) return;
                        setNameSaving(true); setNameError(false);
                        try { await api.updateName(name); onNameChanged?.(name); setSavedToast(true); setTimeout(() => setSavedToast(false), 1800); }
                        catch { setNameError(true); } finally { setNameSaving(false); }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit', flexShrink: 0 }}
                    >{nameSaving ? '...' : 'Сохранить'}</button>
                  )}
                </div>
                {nameError && <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', padding: '4px 0' }}>{tr('Не удалось сохранить имя', 'Не удалось сохранить имя')}</div>}

                {/* Уведомления */}
                <SHead id="s-notifications" label="Уведомления" hint={`Приходят через Telegram — ${botHandle}`} />
                {settings.notifyPausedUntil && new Date(settings.notifyPausedUntil) > new Date() && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                      ⏸ Уведомления на паузе до {new Date(settings.notifyPausedUntil).toLocaleDateString('ru-RU')}
                    </span>
                    <button
                      onClick={() => patch({ notifyPausedUntil: null } as Partial<UserSettings>)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit', flexShrink: 0 }}
                    >Возобновить</button>
                  </div>
                )}
                <SRow title="Итоги дня" sub="Ежедневный отчёт по потребностям" right={<Toggle on={settings.notifyEnabled} onClick={() => patch({ notifyEnabled: !settings.notifyEnabled })} />} />
                <SRow title="Напоминание" sub="Заполнить трекер вечером" right={<Toggle on={!!settings.notifyReminderEnabled} onClick={() => patch({ notifyReminderEnabled: !settings.notifyReminderEnabled })} />} />
                {(settings.notifyEnabled || settings.notifyReminderEnabled) && (<>
                  <SRow title="Время" right={<ChevronVal text={`${pad(localHour)}:00`} />} onClick={() => setSubView('time')} />
                  <SRow title="Частота" right={<ChevronVal text={FREQ_LABELS[settings.notifyFrequency ?? 0]} small />} onClick={() => setSubView('freq')} />
                  <SRow title="Игровой режим" sub="Серии и «ещё день до вехи»" right={<Toggle on={!!settings.notifyGamified} onClick={() => patch({ notifyGamified: !settings.notifyGamified })} />} />
                  <SRow title="Тихие часы" right={<ChevronVal text={quietLabel(settings.notifyQuietStart, settings.notifyQuietEnd)} small />} onClick={() => setSubView('quiet')} />
                  <SRow title="Часовой пояс" right={<ChevronVal text={tzLabel} small />} onClick={() => setSubView('tz')} />
                  {hourInQuiet(localHour, settings.notifyQuietStart, settings.notifyQuietEnd) && (
                    <div style={{ fontSize: 12, color: '#eab308', lineHeight: 1.5, padding: '8px 0' }}>
                      Время уведомления попадает в тихие часы — сообщение придёт после их окончания
                    </div>
                  )}
                </>)}

                {/* Обращение */}
                <SHead id="s-address" label="Обращение" />
                <div style={{ display: 'flex', gap: 8, padding: '13px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                  {(['ty', 'vy'] as const).map(form => {
                    const active = (settings.addressForm ?? 'ty') === form;
                    return (
                      <button key={form} onClick={() => { setAddressForm(form); patch({ addressForm: form }); }}
                        style={{ flex: 1, maxWidth: 160, padding: '10px 0', borderRadius: 8, border: 'none', textAlign: 'center', background: active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.05)', color: active ? '#fff' : 'var(--text-sub)', fontSize: 14, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}
                      >{form === 'ty' ? 'На «ты»' : 'На «вы»'}</button>
                    );
                  })}
                </div>

                {/* Мой терапевт */}
                {userRole !== 'THERAPIST' && (<>
                  <SHead id="s-therapist" label="Мой терапевт" hint={tr('Терапевт видит трекер и задания. Остальное — на твоё усмотрение.', 'Терапевт видит трекер и задания. Остальное — на ваше усмотрение.')} />
                  {therapyRelation === undefined ? (
                    <SRow title="Загрузка..." />
                  ) : therapyRelation?.status === 'active' ? (
                    <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                        {therapyRelation.partnerName ?? 'Терапевт'} подключён
                      </div>
                      <SRow title="Карточки схем и режимов" sub="Личные карточки и заметки" right={<SmallToggle on={!!settings.therapistShareCards} onClick={() => patch({ therapistShareCards: !settings.therapistShareCards })} />} />
                      <SRow title="Профиль и схемы" sub="Активные схемы и результаты теста" right={<SmallToggle on={!!settings.therapistShareProfile} onClick={() => patch({ therapistShareProfile: !settings.therapistShareProfile })} />} />
                      <button onClick={leaveTherapy}
                        style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                        Отключиться от терапевта
                      </button>
                      {leaveTherapyError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 8 }}>{tr('Не удалось отключиться. Проверь связь и попробуй ещё раз', 'Не удалось отключиться. Проверьте связь и попробуйте ещё раз')}</div>}
                    </div>
                  ) : (
                    <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: '0 0 12px', lineHeight: 1.6 }}>
                        {tr('Если терапевт выслал ссылку-приглашение — введи код ниже.', 'Если терапевт выслал ссылку-приглашение — введите код ниже.')}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 12px', lineHeight: 1.6 }}>
                        Ввод кода — это согласие открыть терапевту доступ к своим записям:
                        дневникам, заметкам и результатам опросников (объём настраивается после
                        подключения, отключить терапевта можно в любой момент).
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={therapyJoinCode} onChange={e => setTherapyJoinCode(e.target.value.toUpperCase())}
                          placeholder="ABCDEF" maxLength={8}
                          style={{ flex: 1, background: 'rgba(var(--fg-rgb),0.05)', border: `1px solid ${therapyJoinError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.1)'}`, borderRadius: 7, padding: '8px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'monospace', letterSpacing: 3, outline: 'none' }}
                        />
                        <button onClick={joinTherapy}
                          style={{ background: 'var(--accent)', border: 'none', borderRadius: 7, padding: '8px 16px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Войти
                        </button>
                      </div>
                      {therapyJoinError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 6 }}>{therapyJoinError}</div>}
                    </div>
                  )}
                </>)}

                {/* Стать специалистом */}
                {userRole !== 'THERAPIST' && <BecomeTherapistSection />}

                {/* Кабинет терапевта */}
                {userRole === 'THERAPIST' && (<>
                  <SHead id="s-cabinet" label="Кабинет терапевта" />
                  <SRow title="Открыть кабинет" sub="Клиенты, задания, приглашения" onClick={onOpenTherapistCabinet} />
                  <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                    <button onClick={createInvite} style={{ background: 'none', border: '1px solid rgba(var(--fg-rgb),0.15)', borderRadius: 7, padding: '7px 14px', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      + Создать приглашение клиенту
                    </button>
                    {/* Раньше «Скопировано ✓» показывалось всегда, даже если navigator.clipboard упал — теперь только при реальном успехе, иначе видна ссылка для ручного копирования. */}
                    {therapyInviteUrl && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, wordBreak: 'break-all' }}>{inviteCopied ? 'Скопировано ✓' : therapyInviteUrl}</div>}
                    {inviteError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 8 }}>{tr('Не удалось создать приглашение. Попробуй ещё раз', 'Не удалось создать приглашение. Попробуйте ещё раз')}</div>}
                  </div>
                </>)}

                {/* Партнёр */}
                <SHead id="s-partner" label="Партнёр" hint="Видите индексы дня друг друга — просто число, без деталей" />
                <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                  {pairLoading && !pairData ? (
                    <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Загрузка...</div>
                  ) : pairLoadError && !pairData ? (
                    // Раньше сбой getPair() молча падал в "нет партнёра", и
                    // подключённый пользователь на сетевой ошибке видел
                    // "пригласить друга", будто связь пропала.
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--accent-red)', marginBottom: 8 }}>{tr('Не удалось загрузить данные о партнёре', 'Не удалось загрузить данные о партнёре')}</div>
                      <button onClick={retryPairLoad} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Повторить</button>
                    </div>
                  ) : pairData && pairData.partners.length > 0 ? (
                    pairData.partners.map(p => (
                      <div key={p.code} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 4 }}>{p.partnerName ?? 'Друг'} сегодня</div>
                        {p.partnerTodayDone && p.partnerIndex !== null
                          ? <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 10 }}>{(p.partnerIndex ?? 0).toFixed(1)}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-sub)' }}>/10</span></div>
                          : <div style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 10 }}>Ещё не заполнил</div>
                        }
                        <button onClick={() => leavePair(p.code)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                          Выйти из пары
                        </button>
                        {leavePairError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 6 }}>{tr('Не удалось выйти из пары. Попробуй ещё раз', 'Не удалось выйти из пары. Попробуйте ещё раз')}</div>}
                      </div>
                    ))
                  ) : joinView === 'main' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={createInviteAndShare} disabled={pairLoading}
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
                          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4 }}>{tr('Отправь другу:', 'Отправьте другу:')}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-sub)', wordBreak: 'break-all', marginBottom: 8, userSelect: 'all', fontFamily: 'monospace' }}>{pairInviteUrl}</div>
                          <button onClick={() => void pairInviteCopy.copy(pairInviteUrl)}
                            style={{ background: 'none', border: 'none', color: pairInviteCopy.copied ? 'var(--accent-green)' : pairInviteCopy.failed ? 'var(--accent-red)' : 'var(--accent)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                            {pairInviteCopy.copied ? '✓ Скопировано' : pairInviteCopy.failed ? 'Не скопировалось — ссылка выше' : 'Скопировать ссылку'}
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
                <SRow title="Пригласить друга" sub="Карточка со ссылкой на бота" onClick={() => setAppInvite(true)} />
                <SRow title="Сводка для терапевта" sub="Данные за 30 дней" onClick={async () => {
                  setExportError(false);
                  let text: string;
                  try {
                    ({ text } = await api.getExport());
                  } catch {
                    setExportError(true);
                    return;
                  }
                  let shared = false;
                  try { if (navigator.share) { await navigator.share({ text }); shared = true; } } catch { /* best-effort: ошибку намеренно игнорируем */ }
                  if (!shared) { await exportAutoCopy.copy(text); setExportText(text); }
                }} />
                {exportError && (
                  <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 6 }}>
                    {tr('Не удалось собрать сводку. Проверь связь и попробуй ещё раз', 'Не удалось собрать сводку. Проверьте связь и попробуйте ещё раз')}
                  </div>
                )}

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
                    {/* Подписка скрыта до подключения рекуррента у Robokassa — вернуть ссылку на /subscribe, когда заработает */}
                    <a href="/donate" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-sub)', textDecoration: 'none' }}>
                      Поддержать проект → <span style={{ color: 'var(--accent)' }}>разовый донат</span>
                    </a>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 14 }}>
                    Это образовательный инструмент — не медицинский и не психологический сервис.
                  </div>
                </div>

                {/* Данные */}
                <DataSection />

              </>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Карточка-приглашение в пару ── */}
      {pairShare && (
        <ShareCardSheet
          {...pairInviteShare(pairShare.code, pairShare.url)}
          onClose={() => setPairShare(null)}
          zIndex={400}
        />
      )}

      {/* ── Карточка-приглашение в приложение ── */}
      {appInvite && (
        <ShareCardSheet
          {...appInviteShare(botShortUrl)}
          onClose={() => setAppInvite(false)}
          zIndex={400}
        />
      )}

      {/* ── Export modal ── */}
      {exportText && (
        <ExportSummaryModal text={exportText} onClose={() => setExportText(null)} />
      )}

    </>
  );
}
