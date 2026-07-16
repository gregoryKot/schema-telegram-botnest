import { useState, useEffect } from 'react';
import { api, UserSettings, PairsData, TherapyRelationInfo } from '../api';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from './YSQTestSheet';
import { BottomSheet } from './BottomSheet';
import { Loader } from './Loader';
import { useSafeTop } from '../utils/safezone';
import {
  getTheme,
  toggleTheme,
  resetToSystemTheme,
  Theme,
} from '../utils/theme';
import { useSetAddressForm } from '../utils/addressForm';

const TIMEZONES = [
  { label: 'Лос-Анджелес (UTC−8)', iana: 'America/Los_Angeles' },
  { label: 'Нью-Йорк (UTC−5)', iana: 'America/New_York' },
  { label: 'Лондон (UTC+0)', iana: 'Europe/London' },
  { label: 'Берлин (UTC+1)', iana: 'Europe/Berlin' },
  { label: 'Киев / Израиль (UTC+2)', iana: 'Europe/Kyiv' },
  { label: 'Москва (UTC+3)', iana: 'Europe/Moscow' },
  { label: 'Дубай (UTC+4)', iana: 'Asia/Dubai' },
  { label: 'Ташкент (UTC+5)', iana: 'Asia/Tashkent' },
  { label: 'Алматы (UTC+6)', iana: 'Asia/Almaty' },
  { label: 'Пекин (UTC+8)', iana: 'Asia/Shanghai' },
];

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

const FREQ_LABELS = [
  'Каждый день',
  'Через день',
  'Пару раз в неделю',
  'Раз в неделю',
];

// Пресеты тихих часов: start===end → выключены
const QUIET_PRESETS = [
  { label: 'Выключены', start: 0, end: 0 },
  { label: '21:00 – 08:00', start: 21, end: 8 },
  { label: '22:00 – 08:00', start: 22, end: 8 },
  { label: '23:00 – 07:00', start: 23, end: 7 },
  { label: '00:00 – 08:00', start: 0, end: 8 },
];

function quietLabel(start?: number, end?: number): string {
  if (start === undefined || end === undefined || start === end)
    return 'Выключены';
  return `${pad(start)}:00 – ${pad(end)}:00`;
}

/** Час уведомления внутри окна тишины? (окно может переходить через полночь) */
function hourInQuiet(hour: number, start?: number, end?: number): boolean {
  if (start === undefined || end === undefined || start === end) return false;
  return start > end
    ? hour >= start || hour < end
    : hour >= start && hour < end;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

type View = 'main' | 'time' | 'tz' | 'freq' | 'quiet';

interface Props {
  onClose: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  displayName?: string | null;
  onNameChanged?: (name: string) => void;
  onOpenTherapistCabinet?: () => void;
  therapistMode?: boolean;
  onToggleTherapistMode?: () => void;
}

export function SettingsSheet({
  onClose,
  userRole,
  displayName,
  onNameChanged,
  onOpenTherapistCabinet,
  therapistMode,
  onToggleTherapistMode,
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
  const [exportCopied, setExportCopied] = useState(false);
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
  const tgName =
    (window.Telegram?.WebApp as any)?.initDataUnsafe?.user?.first_name ?? '';
  const [editName, setEditName] = useState(displayName ?? tgName ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme);
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
                view !== 'main' ? setView('main') : onClose();
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
          {/* ── TIME VIEW ── */}
          {view === 'time' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
              }}
            >
              {HOURS.map((h) => {
                const active = h === localHour;
                return (
                  <div
                    key={h}
                    onClick={async () => {
                      await patch({ notifyLocalHour: h });
                      setView('main');
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        await patch({ notifyLocalHour: h });
                        setView('main');
                      }
                    }}
                    style={{
                      padding: '12px 0',
                      borderRadius: 12,
                      textAlign: 'center',
                      background: active
                        ? 'var(--accent)'
                        : 'rgba(var(--fg-rgb),0.06)',
                      color: active ? '#fff' : 'rgba(var(--fg-rgb),0.6)',
                      fontSize: 15,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {pad(h)}:00
                  </div>
                );
              })}
            </div>
          )}

          {/* ── FREQ VIEW ── */}
          {view === 'freq' && (
            <>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  lineHeight: 1.6,
                  marginBottom: 12,
                  padding: '0 4px',
                }}
              >
                Если напоминания будут оставаться без ответа, бот сам начнёт
                писать реже — а когда записи вернутся, вернётся к выбранной
                частоте.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {FREQ_LABELS.map((label, i) => {
                  const active = i === (settings.notifyFrequency ?? 0);
                  return (
                    <div
                      key={i}
                      onClick={async () => {
                        await patch({ notifyFrequency: i });
                        setView('main');
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          await patch({ notifyFrequency: i });
                          setView('main');
                        }
                      }}
                      style={{
                        padding: '13px 16px',
                        borderRadius: 12,
                        background: active
                          ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                          : 'rgba(var(--fg-rgb),0.04)',
                        color: active
                          ? 'var(--accent)'
                          : 'rgba(var(--fg-rgb),0.7)',
                        fontSize: 14,
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      {label}
                      {active && <span>✓</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── QUIET VIEW ── */}
          {view === 'quiet' && (
            <>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  lineHeight: 1.6,
                  marginBottom: 12,
                  padding: '0 4px',
                }}
              >
                В тихие часы бот не пишет вообще — всё, что накопится, придёт
                утром.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {QUIET_PRESETS.map((p) => {
                  const active =
                    p.start === (settings.notifyQuietStart ?? 22) &&
                    p.end === (settings.notifyQuietEnd ?? 8);
                  return (
                    <div
                      key={p.label}
                      onClick={async () => {
                        await patch({
                          notifyQuietStart: p.start,
                          notifyQuietEnd: p.end,
                        });
                        setView('main');
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          await patch({
                            notifyQuietStart: p.start,
                            notifyQuietEnd: p.end,
                          });
                          setView('main');
                        }
                      }}
                      style={{
                        padding: '13px 16px',
                        borderRadius: 12,
                        background: active
                          ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                          : 'rgba(var(--fg-rgb),0.04)',
                        color: active
                          ? 'var(--accent)'
                          : 'rgba(var(--fg-rgb),0.7)',
                        fontSize: 14,
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      {p.label}
                      {active && <span>✓</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── TZ VIEW ── */}
          {view === 'tz' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {TIMEZONES.map((tz) => {
                const active = tz.iana === settings.notifyTimezone;
                return (
                  <div
                    key={tz.iana}
                    onClick={async () => {
                      await patch({ notifyTimezone: tz.iana });
                      setView('main');
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        await patch({ notifyTimezone: tz.iana });
                        setView('main');
                      }
                    }}
                    style={{
                      padding: '13px 16px',
                      borderRadius: 12,
                      background: active
                        ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                        : 'rgba(var(--fg-rgb),0.04)',
                      color: active
                        ? 'var(--accent)'
                        : 'rgba(var(--fg-rgb),0.7)',
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    {tz.label}
                    {active && <span>✓</span>}
                  </div>
                );
              })}
            </div>
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
                      href="https://t.me/SchemaLabBot"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      @SchemaLabBot
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
                <div style={{ marginBottom: 8 }}>
                  <SectionHeader onInfo={() => setShowTherapistInfo(true)}>
                    МОЙ ТЕРАПЕВТ
                  </SectionHeader>
                  <div
                    className="card"
                    style={{ borderRadius: 16, padding: 16 }}
                  >
                    {therapyRelation === undefined ? (
                      <div
                        style={{
                          color: 'var(--text-sub)',
                          fontSize: 13,
                          textAlign: 'center',
                          padding: '8px 0',
                        }}
                      >
                        Загрузка...
                      </div>
                    ) : therapyRelation?.status === 'active' ? (
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            color: 'var(--text)',
                            marginBottom: 12,
                          }}
                        >
                          👨‍⚕️ {therapyRelation.partnerName ?? 'Терапевт'}{' '}
                          подключён
                        </div>

                        {/* Privacy toggles */}
                        <div
                          style={{
                            marginBottom: 12,
                            background: 'rgba(var(--fg-rgb),0.04)',
                            borderRadius: 12,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              padding: '11px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottom:
                                '1px solid rgba(var(--fg-rgb),0.06)',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: 'var(--text)',
                                  fontWeight: 500,
                                }}
                              >
                                Карточки схем и режимов
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-sub)',
                                  marginTop: 1,
                                }}
                              >
                                Личные карточки и заметки
                              </div>
                            </div>
                            <div
                              onClick={() =>
                                patch({
                                  therapistShareCards:
                                    !settings.therapistShareCards,
                                })
                              }
                              role="switch"
                              aria-checked={!!settings.therapistShareCards}
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  void patch({
                                    therapistShareCards:
                                      !settings.therapistShareCards,
                                  });
                                }
                              }}
                              style={{
                                width: 40,
                                height: 22,
                                borderRadius: 11,
                                background: settings.therapistShareCards
                                  ? 'var(--accent)'
                                  : 'rgba(var(--fg-rgb),0.15)',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 2,
                                  left: settings.therapistShareCards ? 20 : 2,
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: 'var(--bg)',
                                  transition: 'left 0.2s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }}
                              />
                            </div>
                          </div>
                          <div
                            style={{
                              padding: '11px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: 'var(--text)',
                                  fontWeight: 500,
                                }}
                              >
                                Профиль и схемы
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-sub)',
                                  marginTop: 1,
                                }}
                              >
                                Активные схемы и результаты теста
                              </div>
                            </div>
                            <div
                              onClick={() =>
                                patch({
                                  therapistShareProfile:
                                    !settings.therapistShareProfile,
                                })
                              }
                              role="switch"
                              aria-checked={!!settings.therapistShareProfile}
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  void patch({
                                    therapistShareProfile:
                                      !settings.therapistShareProfile,
                                  });
                                }
                              }}
                              style={{
                                width: 40,
                                height: 22,
                                borderRadius: 11,
                                background: settings.therapistShareProfile
                                  ? 'var(--accent)'
                                  : 'rgba(var(--fg-rgb),0.15)',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 2,
                                  left: settings.therapistShareProfile ? 20 : 2,
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: 'var(--bg)',
                                  transition: 'left 0.2s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-faint)',
                            lineHeight: 1.5,
                            marginBottom: 12,
                          }}
                        >
                          Трекер потребностей и задания терапевт всегда видит
                        </div>

                        <button
                          onClick={() => {
                            api
                              .leaveTherapy()
                              .then(() => setTherapyRelation(null))
                              .catch(() => {});
                          }}
                          style={{
                            background:
                              'color-mix(in srgb, var(--accent-red) 12%, transparent)',
                            border:
                              '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
                            borderRadius: 10,
                            padding: '8px 16px',
                            color: 'var(--accent-red)',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          Отключиться
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--text-sub)',
                            marginBottom: 10,
                          }}
                        >
                          Если терапевт дал код — введи его здесь
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-faint)',
                            marginBottom: 10,
                            lineHeight: 1.6,
                          }}
                        >
                          Ввод кода — это согласие открыть терапевту доступ к
                          своим записям: дневникам, заметкам и результатам
                          опросников (объём настраивается после подключения,
                          отключить терапевта можно в любой момент).
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            value={therapyJoinCode}
                            onChange={(e) =>
                              setTherapyJoinCode(e.target.value.toUpperCase())
                            }
                            placeholder="ABCDEF"
                            maxLength={8}
                            style={{
                              flex: 1,
                              background: 'rgba(var(--fg-rgb),0.06)',
                              border: `1px solid ${therapyJoinError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.12)'}`,
                              borderRadius: 10,
                              padding: '9px 12px',
                              color: 'var(--text)',
                              fontSize: 14,
                            }}
                          />
                          <button
                            onClick={async () => {
                              if (!therapyJoinCode.trim()) return;
                              setTherapyJoinError('');
                              try {
                                await api.joinTherapy(therapyJoinCode.trim());
                                const rel = await api.getTherapyRelation();
                                setTherapyRelation(rel);
                                setTherapyJoinCode('');
                              } catch {
                                setTherapyJoinError('Неверный код');
                              }
                            }}
                            style={{
                              background: 'var(--accent)',
                              border: 'none',
                              borderRadius: 10,
                              padding: '9px 16px',
                              color: 'var(--text)',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Войти
                          </button>
                        </div>
                        {therapyJoinError && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--accent-red)',
                              marginTop: 6,
                            }}
                          >
                            {therapyJoinError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Стать терапевтом */}
              {userRole !== 'THERAPIST' && (
                <div style={{ marginBottom: 8 }}>
                  {therapistReq === undefined ? null : therapistReq?.status ===
                    'pending' ? (
                    <div
                      className="card"
                      style={{ borderRadius: 16, padding: 16 }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--accent-yellow)',
                          marginBottom: 4,
                        }}
                      >
                        Заявка отправлена
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-sub)',
                          lineHeight: 1.5,
                        }}
                      >
                        Рассмотрим в течение нескольких дней и напишем в боте.
                      </div>
                    </div>
                  ) : therapistReq?.status === 'approved' ? (
                    <div
                      className="card"
                      style={{ borderRadius: 16, padding: 16 }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--accent-green)',
                          marginBottom: 4,
                        }}
                      >
                        ✓ Заявка одобрена
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                        Обновите страницу, чтобы войти как специалист.
                      </div>
                    </div>
                  ) : !showReqForm ? (
                    <button
                      onClick={() => setShowReqForm(true)}
                      style={{
                        width: '100%',
                        padding: '11px 16px',
                        borderRadius: 14,
                        border:
                          '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                        background:
                          'color-mix(in srgb, var(--accent) 6%, transparent)',
                        color: 'var(--accent)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <span>👨‍⚕️</span> Я психолог — подать заявку
                    </button>
                  ) : (
                    <div
                      className="card"
                      style={{ borderRadius: 16, padding: 16 }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--text)',
                          marginBottom: 4,
                        }}
                      >
                        Заявка специалиста
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-sub)',
                          marginBottom: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        Рассмотрим заявку и напишем в боте
                      </div>
                      {[
                        {
                          label: 'Имя и фамилия',
                          val: reqFullName,
                          set: setReqFullName,
                          placeholder: 'Мария Иванова',
                        },
                        {
                          label: 'Квалификация',
                          val: reqQual,
                          set: setReqQual,
                          placeholder: 'Схема-терапевт, КПТ, 5 лет практики',
                        },
                        {
                          label: 'Контакты',
                          val: reqContacts,
                          set: setReqContacts,
                          placeholder: '@telegram или email',
                        },
                      ].map(({ label, val, set, placeholder }) => (
                        <div key={label} style={{ marginBottom: 10 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-sub)',
                              marginBottom: 4,
                            }}
                          >
                            {label}
                          </div>
                          <input
                            value={val}
                            onChange={(e) => set(e.target.value)}
                            placeholder={placeholder}
                            style={{
                              width: '100%',
                              background: 'rgba(var(--fg-rgb),0.06)',
                              border: '1px solid rgba(var(--fg-rgb),0.12)',
                              borderRadius: 10,
                              padding: '9px 12px',
                              color: 'var(--text)',
                              fontSize: 13,
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      ))}
                      <div style={{ marginBottom: 14 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-sub)',
                            marginBottom: 4,
                          }}
                        >
                          Сообщение (необязательно)
                        </div>
                        <textarea
                          value={reqMsg}
                          onChange={(e) => setReqMsg(e.target.value)}
                          placeholder="Расскажи о себе или своём подходе"
                          rows={3}
                          style={{
                            width: '100%',
                            background: 'rgba(var(--fg-rgb),0.06)',
                            border: '1px solid rgba(var(--fg-rgb),0.12)',
                            borderRadius: 10,
                            padding: '9px 12px',
                            color: 'var(--text)',
                            fontSize: 13,
                            outline: 'none',
                            resize: 'none',
                            fontFamily: 'inherit',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      {reqError && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--accent-red)',
                            marginBottom: 10,
                          }}
                        >
                          {reqError}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => {
                            setShowReqForm(false);
                            setReqError('');
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 0',
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
                          disabled={
                            reqBusy ||
                            !reqFullName.trim() ||
                            !reqQual.trim() ||
                            !reqContacts.trim()
                          }
                          onClick={async () => {
                            setReqBusy(true);
                            setReqError('');
                            try {
                              await api.submitTherapistRequest({
                                fullName: reqFullName.trim(),
                                qualification: reqQual.trim(),
                                contacts: reqContacts.trim(),
                                message: reqMsg.trim() || undefined,
                              });
                              const req = await api.getTherapistRequest();
                              setTherapistReq(req);
                              setShowReqForm(false);
                            } catch {
                              setReqError('Ошибка. Попробуй ещё раз.');
                            } finally {
                              setReqBusy(false);
                            }
                          }}
                          style={{
                            flex: 2,
                            padding: '10px 0',
                            borderRadius: 10,
                            border: 'none',
                            background: 'var(--accent)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            opacity:
                              !reqFullName.trim() ||
                              !reqQual.trim() ||
                              !reqContacts.trim()
                                ? 0.5
                                : 1,
                          }}
                        >
                          {reqBusy ? '...' : 'Отправить'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
                      const text =
                        'Трекер потребностей — отслеживай своё состояние каждый день. t.me/SchemaLabBot';
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
                    СхемаЛаб
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
        <BottomSheet
          onClose={() => {
            setExportText(null);
            setExportCopied(false);
          }}
          zIndex={300}
        >
          <div style={{ paddingTop: 4 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 12,
              }}
            >
              Сводка для терапевта
            </div>
            <pre
              style={{
                fontSize: 11,
                color: 'var(--text-sub)',
                lineHeight: 1.6,
                background: 'rgba(var(--fg-rgb),0.04)',
                borderRadius: 12,
                padding: '12px 14px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 14,
                userSelect: 'all',
                fontFamily: 'monospace',
              }}
            >
              {exportText}
            </pre>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportText);
                  setExportCopied(true);
                  setTimeout(() => setExportCopied(false), 2000);
                } catch {
                  /* best-effort: ошибку намеренно игнорируем */
                }
              }}
              style={{
                width: '100%',
                padding: '13px 0',
                border: 'none',
                borderRadius: 12,
                background: exportCopied
                  ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                  : 'rgba(var(--fg-rgb),0.08)',
                color: exportCopied ? '#06d6a0' : 'rgba(var(--fg-rgb),0.7)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {exportCopied ? '✓ Скопировано' : 'Скопировать'}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Notify info */}
      {showNotifyInfo && (
        <BottomSheet onClose={() => setShowNotifyInfo(false)} zIndex={300}>
          <div style={{ paddingTop: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 16,
              }}
            >
              Зачем уведомления
            </div>
            <p
              style={{
                fontSize: 15,
                color: 'rgba(var(--fg-rgb),0.8)',
                lineHeight: 1.7,
                marginBottom: 14,
              }}
            >
              Регулярность — это всё. Один раз в день, в одно и то же время,
              формирует привычку наблюдать за собой.
            </p>
            <p
              style={{
                fontSize: 15,
                color: 'rgba(var(--fg-rgb),0.8)',
                lineHeight: 1.7,
              }}
            >
              <b style={{ color: 'var(--text)' }}>Итоги дня</b> — приходят в это
              же время, если дневник заполнен.
            </p>
          </div>
        </BottomSheet>
      )}

      {/* Pair info */}
      {showPairInfo && (
        <BottomSheet onClose={() => setShowPairInfo(false)} zIndex={300}>
          <div style={{ paddingTop: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 16,
              }}
            >
              Зачем привязывать друга
            </div>
            <p
              style={{
                fontSize: 15,
                color: 'var(--text)',
                lineHeight: 1.7,
                marginBottom: 12,
              }}
            >
              Это необязательно — но может помочь.
            </p>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-sub)',
                lineHeight: 1.7,
                marginBottom: 12,
              }}
            >
              Ты и друг (партнёр, коллега) видите{' '}
              <b style={{ color: 'var(--text)' }}>индексы дня</b> друг друга —
              просто число от 0 до 10. Никаких деталей, дневников или оценок.
            </p>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-sub)',
                lineHeight: 1.7,
              }}
            >
              Иногда знать, что кому-то важно как у тебя дела — уже достаточно.
              Это мягкая взаимная видимость, без осуждения.
            </p>
          </div>
        </BottomSheet>
      )}

      {/* Therapist info */}
      {showTherapistInfo && (
        <BottomSheet onClose={() => setShowTherapistInfo(false)} zIndex={300}>
          <div style={{ paddingTop: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 16,
              }}
            >
              Зачем подключать терапевта
            </div>
            <p
              style={{
                fontSize: 15,
                color: 'var(--text)',
                lineHeight: 1.7,
                marginBottom: 12,
              }}
            >
              Если ты работаешь со схема-терапевтом — приложение может стать
              частью этой работы.
            </p>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-sub)',
                lineHeight: 1.7,
                marginBottom: 12,
              }}
            >
              Терапевт, которому ты дашь код, видит{' '}
              <b style={{ color: 'var(--text)' }}>
                трекер потребностей и задания
              </b>
              . Карточки схем, профиль и дневники ты контролируешь сам — можно
              закрыть в настройках.
            </p>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-sub)',
                lineHeight: 1.7,
              }}
            >
              Это даёт терапевту контекст без лишних объяснений — и позволяет
              работать с реальными паттернами, не с тем, что вспомнилось на
              сессии.
            </p>
          </div>
        </BottomSheet>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({
  children,
  onInfo,
}: {
  children: React.ReactNode;
  onInfo?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        paddingTop: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-sub)',
        }}
      >
        {children}
      </div>
      {onInfo && (
        <button
          onClick={onInfo}
          aria-label="Пояснение"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'rgba(var(--fg-rgb),0.08)',
            color: 'var(--text-faint)',
            fontSize: 9,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            flexShrink: 0,
            padding: 0,
          }}
        >
          ?
        </button>
      )}
    </div>
  );
}

const SettingsLabel = ({ children }: { children: React.ReactNode }) => (
  <SectionHeader>{children}</SectionHeader>
);

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        flexShrink: 0,
        background: on ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)',
        position: 'relative',
        transition: 'background 0.2s',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--bg)',
          transition: 'left 0.2s',
        }}
      />
    </div>
  );
}

function RowRight({ text, small }: { text: string; small?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          fontSize: small ? 13 : 15,
          color: 'var(--text-sub)',
          textAlign: 'right',
          maxWidth: 160,
        }}
      >
        {text}
      </span>
      <span style={{ color: 'var(--text-faint)', fontSize: 16 }}>›</span>
    </div>
  );
}

function Row({
  label,
  sub,
  emoji,
  right,
  onClick,
  divider,
  color,
}: {
  label: string;
  sub?: string;
  emoji?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  divider?: boolean;
  color?: string;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        cursor: onClick ? 'pointer' : 'default',
        borderTop: divider ? '1px solid rgba(var(--fg-rgb),0.05)' : undefined,
      }}
    >
      {emoji && (
        <span
          style={{
            fontSize: 18,
            width: 26,
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          {emoji}
        </span>
      )}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: color ?? 'var(--text)',
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}
          >
            {sub}
          </div>
        )}
      </div>
      {right ??
        (onClick && (
          <span style={{ color: 'var(--text-faint)', fontSize: 16 }}>›</span>
        ))}
    </div>
  );
}
