import { useState, useEffect } from 'react';
import { api, UserSettings, PairsData, TherapyRelationInfo } from '../api';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from './YSQTestSheet';
import { BottomSheet } from './BottomSheet';
import { Loader } from './Loader';
import { useSafeTop } from '../utils/safezone';
import { botShortUrl } from '../utils/botConfig';
import { getTheme, Theme } from '../utils/theme';
import { useSetAddressForm } from '../utils/addressForm';
import { useReducedMotionPref } from '../hooks/useReducedMotionPref';
import { TIMEZONES, type View } from './settingsSheet/constants';
import { SettingsLabel, Row } from './settingsSheet/primitives';
import { NotifySubViews } from './settingsSheet/SubViews';
import {
  NotifyInfoOverlay,
  PairInfoOverlay,
  TherapistInfoOverlay,
} from './settingsSheet/InfoOverlays';
import { ExportOverlay } from './settingsSheet/ExportOverlay';
import { MyTherapistSection } from './settingsSheet/MyTherapistSection';
import { BecomeTherapistSection } from './settingsSheet/BecomeTherapistSection';
import { PartnerSection } from './settingsSheet/PartnerSection';
import { AppearanceSection } from './settingsSheet/AppearanceSection';
import { NotificationsSection } from './settingsSheet/NotificationsSection';
import { AboutSection } from './settingsSheet/AboutSection';

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
              <AppearanceSection
                theme={theme}
                setTheme={setTheme}
                motion={motion}
                userRole={userRole}
                therapistMode={therapistMode}
                onToggleTherapistMode={onToggleTherapistMode}
                onResignTherapist={onResignTherapist}
              />

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
              <NotificationsSection
                settings={settings}
                patch={patch}
                localHour={localHour}
                tzLabel={tzLabel}
                setView={setView}
                onInfo={() => setShowNotifyInfo(true)}
              />

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
              <PartnerSection
                pairData={pairData}
                pairLoading={pairLoading}
                pairInviteUrl={pairInviteUrl}
                pairInviteCopied={pairInviteCopied}
                joinCode={joinCode}
                setJoinCode={setJoinCode}
                joinView={joinView}
                setJoinView={setJoinView}
                joinError={joinError}
                handleCreateInvite={handleCreateInvite}
                handleCopyPairInvite={handleCopyPairInvite}
                handleJoin={handleJoin}
                handleLeave={handleLeave}
                onInfo={() => setShowPairInfo(true)}
              />

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
              <AboutSection />
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
