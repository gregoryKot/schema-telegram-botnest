import { useState, useEffect } from 'react';
import { api, UserSettings, PairsData, TherapyRelationInfo } from '../api';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from './YSQTestSheet';
import { BottomSheet } from './BottomSheet';
import { Loader } from './Loader';
import { useSafeTop } from '../utils/safezone';
import { botUrl, botHandle, botShortUrl } from '../utils/botConfig';
import {
  getTheme,
  toggleTheme,
  resetToSystemTheme,
  Theme,
} from '../utils/theme';
import { useSetAddressForm } from '../utils/addressForm';
import { useReducedMotionPref } from '../hooks/useReducedMotionPref';
import {
  TIMEZONES,
  FREQ_LABELS,
  quietLabel,
  hourInQuiet,
  pad,
  type View,
} from './settingsSheet/constants';
import {
  SectionHeader,
  SettingsLabel,
  Toggle,
  RowRight,
  Row,
} from './settingsSheet/primitives';
import { NotifySubViews } from './settingsSheet/SubViews';
import {
  NotifyInfoOverlay,
  PairInfoOverlay,
  TherapistInfoOverlay,
} from './settingsSheet/InfoOverlays';
import { ExportOverlay } from './settingsSheet/ExportOverlay';
import { MyTherapistSection } from './settingsSheet/MyTherapistSection';
import { BecomeTherapistSection } from './settingsSheet/BecomeTherapistSection';

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

export function SettingsSheet({
  onClose,
  userRole,
  displayName,
  onNameChanged,
  onOpenTherapistCabinet,
  therapistMode,
  onToggleTherapistMode,
  onResignTherapist,
}: Props) {
  const safeTop = useSafeTop();
  const [view, setView] = useState<View>('main');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [pairData, setPairData] = useState<PairsData | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairInviteUrl, setPairInviteUrl] = useState('');
  const [pairInviteCopied, setPairInviteCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinView, setJoinView] = useState<'main' | 'join'>('main');
  const [joinError, setJoinError] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [showNotifyInfo, setShowNotifyInfo] = useState(false);
  const [showPairInfo, setShowPairInfo] = useState(false);
  const [showTherapistInfo, setShowTherapistInfo] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [therapyRelation, setTherapyRelation] = useState<
    TherapyRelationInfo | null | undefined
  >(undefined);
  const [therapyJoinCode, setTherapyJoinCode] = useState('');
  const [therapyJoinError, setTherapyJoinError] = useState('');
  const [therapyInviteUrl, setTherapyInviteUrl] = useState('');
  const [therapistReq, setTherapistReq] = useState<
    | { id: number; status: string; rejectReason: string | null }
    | null
    | undefined
  >(undefined);
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqFullName, setReqFullName] = useState('');
  const [reqQual, setReqQual] = useState('');
  const [reqContacts, setReqContacts] = useState('');
  const [reqMsg, setReqMsg] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  const [reqError, setReqError] = useState('');
  const [resignConfirm, setResignConfirm] = useState(false);
  const [resignBusy, setResignBusy] = useState(false);
  const tgName =
    window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name ?? '';
  const [editName, setEditName] = useState(displayName ?? tgName ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme);
  const motion = useReducedMotionPref(() => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  });
  const setAddressForm = useSetAddressForm();

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch(() =>
        setSettings({
          notifyEnabled: false,
          notifyLocalHour: 21,
          notifyTimezone: 'Europe/Moscow',
          notifyReminderEnabled: false,
          pairCardDismissed: false,
          mySchemaIds: [],
          myModeIds: [],
          therapistShareCards: true,
          therapistShareProfile: true,
        }),
      );
    setPairLoading(true);
    api
      .getPair()
      .then(setPairData)
      .catch(() => {})
      .finally(() => setPairLoading(false));
    api
      .getTherapyRelation()
      .then(setTherapyRelation)
      .catch(() => setTherapyRelation(null));
    api
      .getTherapistRequest()
      .then(setTherapistReq)
      .catch(() => setTherapistReq(null));
  }, []);

  async function patch(update: Partial<UserSettings>) {
    if (!settings) return;
    setSettings((s) => (s ? { ...s, ...update } : s));
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
      try {
        if (navigator.share)
          await navigator.share({
            text: `Давай отслеживать потребности вместе! ${url}`,
          });
      } catch {
        /* best-effort: ошибку намеренно игнорируем */
      }
    } finally {
      setPairLoading(false);
    }
  }

  async function handleCopyPairInvite() {
    try {
      await navigator.clipboard.writeText(pairInviteUrl);
      setPairInviteCopied(true);
      setTimeout(() => setPairInviteCopied(false), 2000);
    } catch {
      /* best-effort: ошибку намеренно игнорируем */
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setPairLoading(true);
    setJoinError(false);
    try {
      await api.joinPair(joinCode.trim().toUpperCase());
      await api.getPair().then(setPairData);
      setJoinView('main');
    } catch {
      setJoinError(true);
    } finally {
      setPairLoading(false);
    }
  }

  async function handleLeave(code: string) {
    await api.leavePair(code).catch(() => {});
    await api
      .getPair()
      .then(setPairData)
      .catch(() => {});
  }

  if (!settings) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader minHeight="40vh" />
      </div>
    );
  }

  const localHour = settings.notifyLocalHour;
  const tzLabel =
    TIMEZONES.find((t) => t.iana === settings.notifyTimezone)?.label ??
    settings.notifyTimezone;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'var(--bg)',
          overflowY: 'auto',
          paddingTop: safeTop,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px 8px',
          }}
        >
          <span
            onClick={() => (view !== 'main' ? setView('main') : onClose())}
            role="button"
            tabIndex={0}
            aria-label={view !== 'main' ? 'Назад' : 'Закрыть'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (view !== 'main') setView('main');
                else onClose();
              }
            }}
            style={{
              fontSize: 26,
              color: 'var(--text-sub)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ‹
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text)',
              flex: 1,
            }}
          >
            {view === 'time'
              ? 'Время уведомления'
              : view === 'tz'
                ? 'Часовой пояс'
                : view === 'freq'
                  ? 'Частота напоминаний'
                  : view === 'quiet'
                    ? 'Тихие часы'
                    : 'Настройки'}
          </span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--accent-green)',
              fontWeight: 600,
              opacity: savedToast ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          >
            Сохранено ✓
          </span>
        </div>

        <div style={{ padding: '8px 16px 120px' }}>
          {view !== 'main' && (
            <NotifySubViews
              view={view}
              settings={settings}
              localHour={localHour}
              patch={patch}
              setView={setView}
            />
          )}

          {/* ── MAIN VIEW ── */}
          {view === 'main' && (
            <>
              {/* Оформление */}
              <div style={{ marginBottom: 8 }}>
                <SettingsLabel>ОФОРМЛЕНИЕ</SettingsLabel>
                <div
                  className="card"
                  style={{ borderRadius: 16, overflow: 'hidden' }}
                >
                  <div
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <span style={{ fontSize: 18 }}>
                        {theme === 'dark' ? '🌙' : '☀️'}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            color: 'var(--text)',
                            fontWeight: 500,
                          }}
                        >
                          {theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
                        </div>
                        <div
                          onClick={() => setTheme(resetToSystemTheme())}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setTheme(resetToSystemTheme());
                            }
                          }}
                          style={{
                            fontSize: 11,
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            marginTop: 1,
                          }}
                        >
                          Авто (по Telegram) →
                        </div>
                      </div>
                    </div>
                    <div
                      onClick={() => setTheme(toggleTheme())}
                      role="switch"
                      aria-checked={theme === 'light'}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setTheme(toggleTheme());
                        }
                      }}
                      style={{
                        width: 46,
                        height: 26,
                        borderRadius: 13,
                        background:
                          theme === 'light'
                            ? 'var(--accent)'
                            : 'color-mix(in srgb, var(--accent) 30%, transparent)',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 3,
                          left: theme === 'light' ? 23 : 3,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: 'var(--bg)',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        }}
                      />
                    </div>
                  </div>
                  {/* Нейроинклюзивность: сниженная анимация (WCAG 2.3.3) */}
                  <Row
                    label="Меньше движения"
                    sub={motion.sub}
                    divider
                    right={
                      <Toggle on={motion.reduced} onClick={motion.toggle} />
                    }
                  />
                  {userRole === 'THERAPIST' && onToggleTherapistMode && (
                    <div
                      style={{
                        borderTop: '1px solid rgba(var(--fg-rgb),0.06)',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 18 }}>👨‍⚕️</span>
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              color: 'var(--text)',
                              fontWeight: 500,
                            }}
                          >
                            Режим специалиста
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-sub)',
                              marginTop: 1,
                            }}
                          >
                            {therapistMode
                              ? 'Кабинет терапевта'
                              : 'Режим клиента'}
                          </div>
                        </div>
                      </div>
                      <div
                        onClick={onToggleTherapistMode}
                        role="switch"
                        aria-checked={!!therapistMode}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggleTherapistMode();
                          }
                        }}
                        style={{
                          width: 46,
                          height: 26,
                          borderRadius: 13,
                          background: therapistMode
                            ? 'var(--accent)'
                            : 'color-mix(in srgb, var(--accent) 30%, transparent)',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 3,
                            left: therapistMode ? 23 : 3,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: 'var(--bg)',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {userRole === 'THERAPIST' && onResignTherapist && (
                    <div
                      style={{
                        borderTop: '1px solid rgba(var(--fg-rgb),0.06)',
                        padding: '14px 16px',
                      }}
                    >
                      {!resignConfirm ? (
                        <button
                          onClick={() => setResignConfirm(true)}
                          style={{
                            width: '100%',
                            padding: '9px 0',
                            borderRadius: 10,
                            border: '1px solid rgba(var(--fg-rgb),0.1)',
                            background: 'transparent',
                            color: 'var(--text-sub)',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          Перестать быть специалистом
                        </button>
                      ) : (
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--text-sub)',
                              lineHeight: 1.5,
                              marginBottom: 10,
                            }}
                          >
                            Роль специалиста будет снята: кабинет и доступ к
                            данным клиентов пропадут. Свои данные не теряешь.
                            Заявку можно подать заново.
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              disabled={resignBusy}
                              onClick={() => setResignConfirm(false)}
                              style={{
                                flex: 1,
                                padding: '9px 0',
                                borderRadius: 10,
                                border: '1px solid rgba(var(--fg-rgb),0.1)',
                                background: 'transparent',
                                color: 'var(--text-sub)',
                                fontSize: 13,
                                cursor: 'pointer',
                              }}
                            >
                              Отмена
                            </button>
                            <button
                              disabled={resignBusy}
                              onClick={() => {
                                setResignBusy(true);
                                void (async () => {
                                  try {
                                    await onResignTherapist();
                                    setResignConfirm(false);
                                  } finally {
                                    setResignBusy(false);
                                  }
                                })();
                              }}
                              style={{
                                flex: 1,
                                padding: '9px 0',
                                borderRadius: 10,
                                border: 'none',
                                background: 'var(--accent-red)',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {resignBusy ? '...' : 'Снять роль'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Имя */}
              <div style={{ marginBottom: 8 }}>
                <SettingsLabel>КАК ТЕБЯ ЗОВУТ</SettingsLabel>
                <div
                  className="card"
                  style={{
                    borderRadius: 16,
                    padding: '12px 16px',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Твоё имя"
                    maxLength={50}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                  {editName !== (displayName ?? tgName) && (
                    <button
                      disabled={nameSaving || !editName.trim()}
                      onClick={async () => {
                        const name = editName.trim();
                        if (!name) return;
                        setNameSaving(true);
                        try {
                          await api.updateName(name);
                          onNameChanged?.(name);
                          setSavedToast(true);
                          setTimeout(() => setSavedToast(false), 1800);
                        } catch {
                          /* best-effort: ошибку намеренно игнорируем */
                        } finally {
                          setNameSaving(false);
                        }
                      }}
                      style={{
                        background:
                          'color-mix(in srgb, var(--accent) 20%, transparent)',
                        border: 'none',
                        borderRadius: 10,
                        padding: '6px 14px',
                        color: 'var(--accent)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {nameSaving ? '...' : 'Сохранить'}
                    </button>
                  )}
                </div>
                {tgName && editName !== tgName && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-faint)',
                      marginTop: 4,
                      padding: '0 4px',
                    }}
                  >
                    В Telegram: {tgName}
                  </div>
                )}
              </div>

              {/* Уведомления */}
              <div style={{ marginBottom: 8 }}>
                <SectionHeader onInfo={() => setShowNotifyInfo(true)}>
                  УВЕДОМЛЕНИЯ
                </SectionHeader>
                {settings.notifyPausedUntil &&
                  new Date(settings.notifyPausedUntil) > new Date() && (
                    <div
                      className="card"
                      style={{
                        borderRadius: 16,
                        padding: '12px 16px',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                        ⏸ Уведомления на паузе до{' '}
                        {new Date(
                          settings.notifyPausedUntil,
                        ).toLocaleDateString('ru-RU')}
                      </div>
                      <button
                        onClick={() =>
                          patch({
                            notifyPausedUntil: null,
                          })
                        }
                        style={{
                          background:
                            'color-mix(in srgb, var(--accent) 15%, transparent)',
                          border: 'none',
                          borderRadius: 10,
                          padding: '7px 14px',
                          color: 'var(--accent)',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        Возобновить
                      </button>
                    </div>
                  )}
                <div
                  className="card"
                  style={{
                    borderRadius: 16,
                    overflow: 'hidden',
                    marginBottom: 8,
                  }}
                >
                  <Row
                    label="Итоги дня"
                    sub="Ежедневный отчёт по потребностям"
                    right={
                      <Toggle
                        on={settings.notifyEnabled}
                        onClick={() =>
                          patch({ notifyEnabled: !settings.notifyEnabled })
                        }
                      />
                    }
                  />
                  <Row
                    label="Напоминание"
                    sub="Заполнить трекер вечером"
                    right={
                      <Toggle
                        on={!!settings.notifyReminderEnabled}
                        onClick={() =>
                          patch({
                            notifyReminderEnabled:
                              !settings.notifyReminderEnabled,
                          })
                        }
                      />
                    }
                    divider
                  />
                  {(settings.notifyEnabled ||
                    settings.notifyReminderEnabled) && (
                    <>
                      <Row
                        label="Время"
                        right={<RowRight text={`${pad(localHour)}:00`} />}
                        onClick={() => setView('time')}
                        divider
                      />
                      <Row
                        label="Частота"
                        right={
                          <RowRight
                            text={FREQ_LABELS[settings.notifyFrequency ?? 0]}
                            small
                          />
                        }
                        onClick={() => setView('freq')}
                        divider
                      />
                      <Row
                        label="Игровой режим"
                        sub="Серии и «ещё день до вехи»"
                        right={
                          <Toggle
                            on={!!settings.notifyGamified}
                            onClick={() =>
                              patch({
                                notifyGamified: !settings.notifyGamified,
                              })
                            }
                          />
                        }
                        divider
                      />
                      <Row
                        label="Тихие часы"
                        right={
                          <RowRight
                            text={quietLabel(
                              settings.notifyQuietStart,
                              settings.notifyQuietEnd,
                            )}
                            small
                          />
                        }
                        onClick={() => setView('quiet')}
                        divider
                      />
                      <Row
                        label="Часовой пояс"
                        right={<RowRight text={tzLabel} small />}
                        onClick={() => setView('tz')}
                        divider
                      />
                    </>
                  )}
                </div>
                {(settings.notifyEnabled || settings.notifyReminderEnabled) &&
                  hourInQuiet(
                    localHour,
                    settings.notifyQuietStart,
                    settings.notifyQuietEnd,
                  ) && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--accent-yellow, #eab308)',
                        lineHeight: 1.5,
                        marginBottom: 8,
                        padding: '0 4px',
                      }}
                    >
                      Время уведомления попадает в тихие часы — сообщение придёт
                      после их окончания
                    </div>
                  )}
                {(settings.notifyEnabled || settings.notifyReminderEnabled) && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-sub)',
                      lineHeight: 1.5,
                      marginBottom: 8,
                      padding: '0 4px',
                    }}
                  >
                    Приходят через{' '}
                    <a
                      href={botUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      {botHandle}
                    </a>
                  </div>
                )}
              </div>

              {/* Обращение */}
              <div style={{ marginBottom: 8 }}>
                <SettingsLabel>ОБРАЩЕНИЕ</SettingsLabel>
                <div
                  className="card"
                  style={{
                    borderRadius: 16,
                    padding: '10px 12px',
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  {(['ty', 'vy'] as const).map((form) => {
                    const active = (settings.addressForm ?? 'ty') === form;
                    return (
                      <div
                        key={form}
                        onClick={() => {
                          setAddressForm(form);
                          void patch({ addressForm: form });
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setAddressForm(form);
                            void patch({ addressForm: form });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 0',
                          borderRadius: 10,
                          textAlign: 'center',
                          background: active
                            ? 'var(--accent)'
                            : 'rgba(var(--fg-rgb),0.06)',
                          color: active ? '#fff' : 'var(--text-sub)',
                          fontSize: 14,
                          fontWeight: active ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {form === 'ty' ? 'На «ты»' : 'На «вы»'}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Терапевт — CLIENT view */}
              {userRole !== 'THERAPIST' && (
                <MyTherapistSection
                  therapyRelation={therapyRelation}
                  setTherapyRelation={setTherapyRelation}
                  settings={settings}
                  patch={patch}
                  therapyJoinCode={therapyJoinCode}
                  setTherapyJoinCode={setTherapyJoinCode}
                  therapyJoinError={therapyJoinError}
                  setTherapyJoinError={setTherapyJoinError}
                  onInfo={() => setShowTherapistInfo(true)}
                />
              )}

              {/* Стать терапевтом */}
              {userRole !== 'THERAPIST' && (
                <BecomeTherapistSection
                  therapistReq={therapistReq}
                  setTherapistReq={setTherapistReq}
                  showReqForm={showReqForm}
                  setShowReqForm={setShowReqForm}
                  reqFullName={reqFullName}
                  setReqFullName={setReqFullName}
                  reqQual={reqQual}
                  setReqQual={setReqQual}
                  reqContacts={reqContacts}
                  setReqContacts={setReqContacts}
                  reqMsg={reqMsg}
                  setReqMsg={setReqMsg}
                  reqBusy={reqBusy}
                  setReqBusy={setReqBusy}
                  reqError={reqError}
                  setReqError={setReqError}
                />
              )}

              {/* Терапевт — THERAPIST view */}
              {userRole === 'THERAPIST' && (
                <div style={{ marginBottom: 8 }}>
                  <SettingsLabel>КАБИНЕТ ТЕРАПЕВТА</SettingsLabel>
                  <div
                    className="card"
                    style={{ borderRadius: 16, overflow: 'hidden' }}
                  >
                    <div
                      onClick={onOpenTherapistCabinet}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenTherapistCabinet?.();
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'var(--accent)',
                          }}
                        >
                          Открыть кабинет
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-faint)',
                            marginTop: 2,
                          }}
                        >
                          Клиенты, задания, приглашения
                        </div>
                      </div>
                      <span
                        style={{ color: 'var(--text-faint)', fontSize: 18 }}
                      >
                        ›
                      </span>
                    </div>
                    <div
                      style={{
                        borderTop: '1px solid rgba(var(--fg-rgb),0.05)',
                        padding: '12px 16px',
                      }}
                    >
                      <button
                        onClick={async () => {
                          try {
                            const { url } = await api.createTherapyInvite();
                            setTherapyInviteUrl(url);
                            try {
                              await navigator.clipboard.writeText(url);
                            } catch {
                              /* ignore */
                            }
                          } catch {
                            /* ignore */
                          }
                        }}
                        style={{
                          background:
                            'color-mix(in srgb, var(--accent) 12%, transparent)',
                          border:
                            '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                          borderRadius: 10,
                          padding: '8px 16px',
                          color: 'var(--accent)',
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        + Создать приглашение клиенту
                      </button>
                      {therapyInviteUrl && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-sub)',
                            marginTop: 8,
                            wordBreak: 'break-all',
                          }}
                        >
                          Скопировано: {therapyInviteUrl.slice(0, 50)}...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Партнёр */}
              <div style={{ marginBottom: 8 }}>
                <SectionHeader onInfo={() => setShowPairInfo(true)}>
                  ПАРТНЁР
                </SectionHeader>
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
                              color: pairInviteCopied
                                ? '#06d6a0'
                                : 'var(--accent)',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {pairInviteCopied
                              ? '✓ Скопировано'
                              : 'Скопировать ссылку'}
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
                        onChange={(e) =>
                          setJoinCode(e.target.value.toUpperCase())
                        }
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

              {/* Поделиться + Экспорт */}
              <div style={{ marginBottom: 8 }}>
                <SettingsLabel>ПОДЕЛИТЬСЯ</SettingsLabel>
                <div
                  className="card"
                  style={{ borderRadius: 16, overflow: 'hidden' }}
                >
                  <Row
                    label="Пригласить друга"
                    sub="Поделиться ссылкой на бота"
                    emoji="🔗"
                    onClick={async () => {
                      const text = `Трекер потребностей — отслеживай своё состояние каждый день. ${botShortUrl}`;
                      try {
                        if (navigator.share) await navigator.share({ text });
                        else await navigator.clipboard.writeText(text);
                      } catch {
                        try {
                          await navigator.clipboard.writeText(text);
                        } catch {
                          /* best-effort: ошибку намеренно игнорируем */
                        }
                      }
                    }}
                  />
                  <Row
                    label="Для терапевта"
                    sub="Сводка за 30 дней"
                    emoji="📤"
                    divider
                    onClick={async () => {
                      const { text } = await api.getExport();
                      let shared = false;
                      try {
                        if (navigator.share) {
                          await navigator.share({ text });
                          shared = true;
                        }
                      } catch {
                        /* best-effort: ошибку намеренно игнорируем */
                      }
                      if (!shared) {
                        try {
                          await navigator.clipboard.writeText(text);
                        } catch {
                          /* best-effort: ошибку намеренно игнорируем */
                        }
                        setExportText(text);
                      }
                    }}
                  />
                </div>
              </div>

              {/* О приложении */}
              <div style={{ marginBottom: 8 }}>
                <SettingsLabel>О ПРИЛОЖЕНИИ</SettingsLabel>
                <div
                  className="card"
                  style={{ borderRadius: 16, padding: '20px 16px' }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: 'var(--text)',
                      letterSpacing: '-0.5px',
                      marginBottom: 10,
                    }}
                  >
                    Всё по схеме
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      color: 'var(--text-sub)',
                      lineHeight: 1.7,
                      margin: '0 0 16px',
                    }}
                  >
                    Инструмент самопознания на основе схема-терапии: трекер
                    потребностей, дневники схем и режимов, тесты, практики и
                    пространство для работы с терапевтом.
                  </p>
                  <div
                    style={{
                      height: 1,
                      background: 'rgba(var(--fg-rgb),0.07)',
                      marginBottom: 16,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text-sub)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: 12,
                    }}
                  >
                    Об авторе
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--text-sub)',
                        lineHeight: 1.6,
                      }}
                    >
                      Канал о схема-терапии —{' '}
                      <a
                        href="https://t.me/SchemeHappens"
                        style={{
                          color: 'var(--accent)',
                          textDecoration: 'none',
                        }}
                      >
                        @SchemeHappens
                      </a>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--text-sub)',
                        lineHeight: 1.6,
                      }}
                    >
                      Записаться на сессию —{' '}
                      <a
                        href="https://t.me/kotlarewski"
                        style={{
                          color: 'var(--accent)',
                          textDecoration: 'none',
                        }}
                      >
                        @kotlarewski
                      </a>
                    </div>
                    {/* Подписка скрыта до подключения рекуррента у Robokassa */}
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--text-sub)',
                        lineHeight: 1.6,
                      }}
                    >
                      Поддержать проект —{' '}
                      <a
                        href="https://schemehappens.ru/donate"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--accent)',
                          textDecoration: 'none',
                        }}
                      >
                        разовый донат 💛
                      </a>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-faint)',
                      lineHeight: 1.5,
                    }}
                  >
                    Разработано для образовательных целей. Не является
                    медицинским или психологическим сервисом.
                  </div>
                </div>
              </div>

              {/* Конфиденциальность */}
              <div style={{ marginBottom: 8 }}>
                <SettingsLabel>ДАННЫЕ</SettingsLabel>
                <div
                  className="card"
                  style={{ borderRadius: 16, overflow: 'hidden' }}
                >
                  <Row
                    label="О данных и конфиденциальности"
                    emoji="🔒"
                    onClick={() => setShowPrivacy(true)}
                  />
                  <Row
                    label="Удалить все данные"
                    emoji="🗑"
                    divider
                    color="#f87171"
                    onClick={() => {
                      setDeleteConfirm(false);
                      setShowDeleteSheet(true);
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Export text overlay */}
      {exportText && (
        <ExportOverlay
          text={exportText}
          onClose={() => {
            setExportText(null);
          }}
        />
      )}

      {/* Notify info */}
      {showNotifyInfo && (
        <NotifyInfoOverlay onClose={() => setShowNotifyInfo(false)} />
      )}

      {showPairInfo && (
        <PairInfoOverlay onClose={() => setShowPairInfo(false)} />
      )}

      {showTherapistInfo && (
        <TherapistInfoOverlay onClose={() => setShowTherapistInfo(false)} />
      )}

      {/* Privacy */}
      {showPrivacy && (
        <BottomSheet
          onClose={() => {
            setShowPrivacy(false);
            setDeleteConfirm(false);
          }}
          zIndex={300}
        >
          <div style={{ paddingTop: 4 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
              }}
            >
              Данные и конфиденциальность
            </div>

            {[
              {
                title: 'Что хранится на сервере',
                text: 'Дневник, оценки, заметки, практики, результаты тестов — всё привязано к Telegram-аккаунту и доступно с любого устройства.',
              },
              {
                title: 'Передача третьим лицам',
                text: 'Данные не продаются и не передаются рекламным сетям или третьим лицам. Никогда.',
              },
            ].map((block) => (
              <div
                key={block.title}
                style={{
                  marginBottom: 12,
                  background: 'rgba(var(--fg-rgb),0.04)',
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(var(--fg-rgb),0.8)',
                    marginBottom: 6,
                  }}
                >
                  {block.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-sub)',
                    lineHeight: 1.6,
                  }}
                >
                  {block.text}
                </div>
              </div>
            ))}

            {(!!localStorage.getItem(YSQ_PROGRESS_KEY) ||
              !!localStorage.getItem(YSQ_RESULT_KEY)) && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(var(--fg-rgb),0.8)',
                    marginBottom: 10,
                  }}
                >
                  Удалить данные теста
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem(YSQ_PROGRESS_KEY);
                    localStorage.removeItem(YSQ_RESULT_KEY);
                    api.deleteYsqResult().catch(() => {});
                    setShowPrivacy(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '13px 0',
                    borderRadius: 12,
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.08)',
                    color: 'var(--accent-red)',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Удалить результаты теста
                </button>
              </div>
            )}

            <div
              style={{
                fontSize: 11,
                color: 'var(--text-faint)',
                lineHeight: 1.6,
                textAlign: 'center',
              }}
            >
              Разработано для образовательных целей. Не является медицинским или
              психологическим сервисом.
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Delete sheet — прямой флоу */}
      {showDeleteSheet && (
        <BottomSheet
          onClose={() => {
            setShowDeleteSheet(false);
            setDeleteConfirm(false);
          }}
          zIndex={300}
        >
          <div style={{ paddingTop: 4 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--accent-red)',
                marginBottom: 8,
              }}
            >
              Удалить все данные
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              Дневники, оценки, практики, колесо детства, результаты тестов,
              заметки, задания, связи с терапевтом — всё удалится с сервера. Это
              действие необратимо.
            </div>
            {!deleteConfirm ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowDeleteSheet(false)}
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    borderRadius: 14,
                    border: '1px solid rgba(var(--fg-rgb),0.1)',
                    background: 'transparent',
                    color: 'var(--text-sub)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    borderRadius: 14,
                    border: 'none',
                    background: 'rgba(239,68,68,0.15)',
                    color: 'var(--accent-red)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Удалить
                </button>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--accent-red)',
                    textAlign: 'center',
                    marginBottom: 16,
                    fontWeight: 500,
                  }}
                >
                  Точно? Восстановить невозможно.
                </div>
                <button
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await api.deleteAllUserData();
                      const theme = localStorage.getItem('app_theme');
                      localStorage.clear();
                      sessionStorage.clear();
                      if (theme) localStorage.setItem('app_theme', theme);
                      window.location.reload();
                    } catch {
                      setDeleting(false);
                      setDeleteConfirm(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    borderRadius: 14,
                    border: 'none',
                    background: '#ef4444',
                    color: 'var(--text)',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: deleting ? 'default' : 'pointer',
                  }}
                >
                  {deleting ? 'Удаляем...' : 'Да, удалить всё навсегда'}
                </button>
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
