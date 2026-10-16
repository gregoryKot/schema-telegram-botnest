import { useState, useEffect } from 'react';
import '../styles/sheet-settings.css';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api, type UserSettings } from '../api';
import { Loader } from './Loader';
import { useTimedFlag } from '../../../shared/src/hooks/useTimedFlag';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { pairInviteShare } from '../../../shared/src/share/cards/inviteShare';
import { TIMEZONES } from '../../../shared/src/settings/constants';
import { usePairSettings } from './settingsSheet/usePairSettings';
import { useTherapyRelationSettings } from './settingsSheet/useTherapyRelationSettings';
import { AppearanceSection } from './settingsSheet/AppearanceSection';
import { BecomeTherapistSection } from './settingsSheet/BecomeTherapistSection';
import { DataSection } from './settingsSheet/DataSection';
import { SettingsSubView, type SubView } from './settingsSheet/SubViews';
import { NotificationsSection } from './settingsSheet/NotificationsSection';
import { NameSection, AddressSection } from './settingsSheet/NameAddressSections';
import { MyTherapistSection, CabinetSection } from './settingsSheet/TherapistSections';
import { PartnerSection } from './settingsSheet/PartnerSection';
import { ShareSection, AboutSection } from './settingsSheet/ShareAboutSections';

// Дефолты на случай, если api.getSettings() отказал — экран не должен
// зависнуть на Loader, показываем безопасные значения.
const DEFAULT_SETTINGS: UserSettings = {
  notifyEnabled: false, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: false, pairCardDismissed: false, mySchemaIds: [], myModeIds: [],
  therapistShareCards: true, therapistShareProfile: true,
};

const SUB_TITLES: Record<SubView, string> = {
  main: 'Настройки', time: 'Время уведомления', tz: 'Часовой пояс', freq: 'Частота напоминаний', quiet: 'Тихие часы',
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
  const goBack = useHistorySheet(onClose);
  const dialogA11y = useDialogA11y();
  const [subView, setSubView] = useState<SubView>('main');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const pair = usePairSettings(userRole);
  const therapy = useTherapyRelationSettings(userRole);
  const [pairShare, setPairShare] = useState<{ code: string; url: string } | null>(null);
  const [savedToast, flashSaved] = useTimedFlag(1800); const [saveError, flashSaveError] = useTimedFlag(2400); // «Сохранено» раньше шло даже при отказе api
  const [editName, setEditName] = useState(displayName ?? '');

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  async function patch(update: Partial<UserSettings>) {
    if (!settings) return;
    const prev = settings; setSettings(s => s ? { ...s, ...update } : s);
    try { await api.updateSettings(update); flashSaved(); }
    catch { setSettings(prev); flashSaveError(); }
  }

  const scrollTo = (id: string) => {
    scrollIntoViewSafe(document.getElementById(id), { block: 'start' });
  };

  const isTherapist = userRole === 'THERAPIST';
  const navItems = [
    { id: 's-appearance', label: 'Оформление' },
    { id: 's-name', label: 'Имя' },
    { id: 's-notifications', label: 'Уведомления' },
    ...(!isTherapist ? [
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
      <div className="settings-overlay st-overlay st-overlay--loading">
        <Loader minHeight="40vh" />
      </div>
    );
  }

  const tzLabel = TIMEZONES.find(t => t.iana === settings.notifyTimezone)?.label ?? settings.notifyTimezone;

  return (
    <>
      <div {...dialogA11y} className="settings-overlay st-overlay">

        {/* ── Header ── */}
        <div className="st-head">
          <button className="ds-link" onClick={subView !== 'main' ? () => setSubView('main') : goBack}>
            ← {subView !== 'main' ? 'Назад' : 'Закрыть'}
          </button>
          <h2 className="ds-h2 st-title">{SUB_TITLES[subView]}</h2>
          <span className={`ds-badge ${saveError ? 'st-toast is-err' : 'ds-badge--ok st-toast'}${savedToast || saveError ? ' is-on' : ''}`}>
            {saveError ? 'Не сохранилось' : 'Сохранено ✓'}
          </span>
        </div>

        {/* ── Body ── */}
        <div className="st-body">
          {subView === 'main' && (
            <div className="settings-sidenav">
              {navItems.map(n => (
                <button key={n.id} onClick={() => scrollTo(n.id)} className="settings-sidenav-item st-navitem">
                  {n.label}
                </button>
              ))}
            </div>
          )}

          <div className="st-scroll">
            <div className="settings-content-inner st-inner">
              {subView !== 'main' && (
                <SettingsSubView subView={subView} settings={settings} patch={patch} onDone={() => setSubView('main')} />
              )}

              {subView === 'main' && (<>
                <AppearanceSection
                  userRole={userRole}
                  therapistMode={therapistMode}
                  onToggleTherapistMode={onToggleTherapistMode}
                  onResignTherapist={onResignTherapist}
                  onSaved={() => { flashSaved(); }}
                />
                <NameSection value={editName} onChange={setEditName} displayName={displayName} onNameChanged={onNameChanged} onSaved={flashSaved} />
                <NotificationsSection settings={settings} tzLabel={tzLabel} patch={patch} openSubView={setSubView} />
                <AddressSection settings={settings} patch={patch} />
                {!isTherapist && <MyTherapistSection rel={therapy} settings={settings} patch={patch} />}
                {!isTherapist && <BecomeTherapistSection />}
                {isTherapist && <CabinetSection rel={therapy} onOpenTherapistCabinet={onOpenTherapistCabinet} />}
                <PartnerSection pair={pair} onInviteCreated={setPairShare} />
                <ShareSection />
                <AboutSection />
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
    </>
  );
}
