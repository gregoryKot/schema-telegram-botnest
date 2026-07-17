import { useState, useEffect } from 'react';
import { api, UserSettings, PairsData, TherapyRelationInfo } from '../api';
import { Loader } from './Loader';
import { useSafeTop } from '../utils/safezone';
import { getTheme, Theme } from '../utils/theme';
import { useSetAddressForm } from '../utils/addressForm';
import { TIMEZONES, View } from './settingsSheet/constants';
import {
  TimeView,
  FreqView,
  QuietView,
  TzView,
} from './settingsSheet/SubViews';
import { AppearanceSection } from './settingsSheet/AppearanceSection';
import { NameSection } from './settingsSheet/NameSection';
import { NotificationsSection } from './settingsSheet/NotificationsSection';
import { AddressFormSection } from './settingsSheet/AddressFormSection';
import { MyTherapistSection } from './settingsSheet/MyTherapistSection';
import { BecomeTherapistSection } from './settingsSheet/BecomeTherapistSection';
import { TherapistCabinetSection } from './settingsSheet/TherapistCabinetSection';
import { PartnerSection } from './settingsSheet/PartnerSection';
import { ShareExportSection } from './settingsSheet/ShareExportSection';
import { AboutSection } from './settingsSheet/AboutSection';
import { DataSection } from './settingsSheet/DataSection';
import { ExportOverlay } from './settingsSheet/ExportOverlay';
import {
  NotifyInfoOverlay,
  PairInfoOverlay,
  TherapistInfoOverlay,
} from './settingsSheet/InfoOverlays';
import { PrivacyOverlay } from './settingsSheet/PrivacyOverlay';
import { DeleteOverlay } from './settingsSheet/DeleteOverlay';

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
    window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name ?? '';
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
        /* игнорируем */
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
      /* игнорируем */
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
          {/* ── TIME VIEW ── */}
          {view === 'time' && (
            <TimeView localHour={localHour} patch={patch} setView={setView} />
          )}

          {/* ── FREQ VIEW ── */}
          {view === 'freq' && (
            <FreqView settings={settings} patch={patch} setView={setView} />
          )}

          {/* ── QUIET VIEW ── */}
          {view === 'quiet' && (
            <QuietView settings={settings} patch={patch} setView={setView} />
          )}

          {/* ── TZ VIEW ── */}
          {view === 'tz' && (
            <TzView settings={settings} patch={patch} setView={setView} />
          )}

          {/* ── MAIN VIEW ── */}
          {view === 'main' && (
            <>
              <AppearanceSection
                theme={theme}
                setTheme={setTheme}
                userRole={userRole}
                therapistMode={therapistMode}
                onToggleTherapistMode={onToggleTherapistMode}
              />

              <NameSection
                editName={editName}
                setEditName={setEditName}
                displayName={displayName}
                tgName={tgName}
                nameSaving={nameSaving}
                setNameSaving={setNameSaving}
                onNameChanged={onNameChanged}
                showSavedToast={() => {
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 1800);
                }}
              />

              <NotificationsSection
                settings={settings}
                patch={patch}
                localHour={localHour}
                tzLabel={tzLabel}
                setView={setView}
                onInfo={() => setShowNotifyInfo(true)}
              />

              <AddressFormSection
                settings={settings}
                patch={patch}
                setAddressForm={setAddressForm}
              />

              {userRole !== 'THERAPIST' && (
                <MyTherapistSection
                  settings={settings}
                  patch={patch}
                  therapyRelation={therapyRelation}
                  setTherapyRelation={setTherapyRelation}
                  therapyJoinCode={therapyJoinCode}
                  setTherapyJoinCode={setTherapyJoinCode}
                  therapyJoinError={therapyJoinError}
                  setTherapyJoinError={setTherapyJoinError}
                  onInfo={() => setShowTherapistInfo(true)}
                />
              )}

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

              {userRole === 'THERAPIST' && (
                <TherapistCabinetSection
                  onOpenTherapistCabinet={onOpenTherapistCabinet}
                  therapyInviteUrl={therapyInviteUrl}
                  setTherapyInviteUrl={setTherapyInviteUrl}
                  onResignTherapist={onResignTherapist}
                />
              )}

              <PartnerSection
                pairLoading={pairLoading}
                pairData={pairData}
                joinView={joinView}
                setJoinView={setJoinView}
                handleLeave={handleLeave}
                handleCreateInvite={handleCreateInvite}
                pairInviteUrl={pairInviteUrl}
                handleCopyPairInvite={handleCopyPairInvite}
                pairInviteCopied={pairInviteCopied}
                joinCode={joinCode}
                setJoinCode={setJoinCode}
                joinError={joinError}
                handleJoin={handleJoin}
                onInfo={() => setShowPairInfo(true)}
              />

              <ShareExportSection setExportText={setExportText} />

              <AboutSection />

              <DataSection
                onShowPrivacy={() => setShowPrivacy(true)}
                onShowDelete={() => {
                  setDeleteConfirm(false);
                  setShowDeleteSheet(true);
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Export text overlay */}
      {exportText && (
        <ExportOverlay
          exportText={exportText}
          onClose={() => {
            setExportText(null);
            setExportCopied(false);
          }}
          exportCopied={exportCopied}
          setExportCopied={setExportCopied}
        />
      )}

      {/* Notify info */}
      {showNotifyInfo && (
        <NotifyInfoOverlay onClose={() => setShowNotifyInfo(false)} />
      )}

      {/* Pair info */}
      {showPairInfo && (
        <PairInfoOverlay onClose={() => setShowPairInfo(false)} />
      )}

      {/* Therapist info */}
      {showTherapistInfo && (
        <TherapistInfoOverlay onClose={() => setShowTherapistInfo(false)} />
      )}

      {/* Privacy */}
      {showPrivacy && (
        <PrivacyOverlay
          onClose={() => {
            setShowPrivacy(false);
            setDeleteConfirm(false);
          }}
          onCloseAfterYsqDelete={() => setShowPrivacy(false)}
        />
      )}

      {/* Delete sheet — прямой флоу */}
      {showDeleteSheet && (
        <DeleteOverlay
          onClose={() => {
            setShowDeleteSheet(false);
            setDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteSheet(false)}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          deleting={deleting}
          setDeleting={setDeleting}
        />
      )}
    </>
  );
}
