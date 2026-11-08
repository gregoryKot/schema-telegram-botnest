import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/sheet-settings.css';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api, type UserSettings } from '../api';
import { SettingsSkeleton } from './settingsSheet/SettingsSkeleton';
import { useSaveBadge } from './settingsSheet/useSaveBadge';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { pairInviteShare } from '../../../shared/src/share/cards/inviteShare';
import { timezoneLabel } from '../../../shared/src/settings/timezones';
import { useSitePair } from './settingsSheet/useSitePair';
import { useTherapyRelationSettings } from './settingsSheet/useTherapyRelationSettings';
import { AppearanceSection } from './settingsSheet/AppearanceSection';
import { ModeSection } from './settingsSheet/ModeSection';
import { BecomeTherapistSection } from './settingsSheet/BecomeTherapistSection';
import { DataSection } from './settingsSheet/DataSection';
import { SettingsSubView, type SubView } from './settingsSheet/SubViews';
import { NotificationsSection } from './settingsSheet/NotificationsSection';
import { NameSection, AddressSection } from './settingsSheet/NameAddressSections';
import { MyTherapistSection, CabinetSection } from './settingsSheet/TherapistSections';
import { PartnerSection } from './settingsSheet/PartnerSection';
import { ShareSection, AboutSection } from './settingsSheet/ShareAboutSections';
import { HomeScreenSection } from './settingsSheet/HomeScreenSection';
import { homeIconMode } from './settingsSheet/homeIconMode';

// Дефолты на случай, если api.getSettings() отказал — экран не должен
// зависнуть на Loader, показываем безопасные значения.
const DEFAULT_SETTINGS: UserSettings = {
  notifyEnabled: false, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: false, notifySummaryEnabled: false, pairCardDismissed: false, mySchemaIds: [], myModeIds: [],
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
  /** Выбор режима (true — кабинет); лист закрывается до переключения — goBack(then), см. useHistorySheet (#902). */
  onSetTherapistMode?: (on: boolean) => void;
  onResignTherapist?: () => Promise<void> | void;
}

export function SettingsSheet({ onClose, userRole, displayName, onNameChanged, onOpenTherapistCabinet, therapistMode, onSetTherapistMode, onResignTherapist }: Props) {
  const goBack = useHistorySheet(onClose);
  const navigate = useNavigate();
  const dialogA11y = useDialogA11y();
  const [subView, setSubView] = useState<SubView>('main');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const therapy = useTherapyRelationSettings(userRole);
  const [pairShare, setPairShare] = useState<{ code: string; url: string } | null>(null);
  const pair = useSitePair(userRole, (code, url) => setPairShare({ code, url }));
  const { visible: badgeOn, outcome, flashSaved, flashError: flashSaveError } = useSaveBadge(); // «Сохранено» раньше шло даже при отказе api
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

  const scrollTo = (id: string) => scrollIntoViewSafe(document.getElementById(id), { block: 'start' });

  const isTherapist = userRole === 'THERAPIST';
  const homeMode = homeIconMode();
  const navItems = [
    ...(isTherapist && onSetTherapistMode ? [{ id: 's-mode', label: 'Режим' }] : []),
    { id: 's-appearance', label: 'Оформление' },
    ...(homeMode ? [{ id: 's-home', label: 'Значок на экране' }] : []),
    { id: 's-name', label: 'Имя' },
    { id: 's-notifications', label: 'Уведомления' },
    { id: 's-address', label: 'Обращение' }, // раздел был, строки в оглавлении не было (QA 2026-11, М10)
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

  if (!settings) return <div {...dialogA11y} className="settings-overlay st-overlay"><SettingsSkeleton onClose={goBack} /></div>;

  const tzLabel = timezoneLabel(settings.notifyTimezone);

  return (
    <>
      <div {...dialogA11y} className="settings-overlay st-overlay">

        {/* ── Header ── */}
        <div className="ds-sheet-head">
          <button type="button" className="ds-back" onClick={subView !== 'main' ? () => setSubView('main') : goBack}>
            ← {subView !== 'main' ? 'Назад' : 'Закрыть'}
          </button>
          <h2 className="ds-h2">{SUB_TITLES[subView]}</h2>
          <span className={`ds-badge ${outcome === 'err' ? 'st-toast is-err' : 'ds-badge--ok st-toast'}${badgeOn ? ' is-on' : ''}`}>
            {outcome === 'err' ? 'Не сохранилось' : 'Сохранено ✓'}
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
                {isTherapist && onSetTherapistMode && <ModeSection therapistMode={!!therapistMode}
                  onSelect={(on) => goBack(() => onSetTherapistMode(on))} onOpenAccount={() => goBack(() => navigate('/account'))} />}
                <AppearanceSection userRole={userRole} onResignTherapist={onResignTherapist} onSaved={flashSaved} />
                {homeMode && <HomeScreenSection mode={homeMode} />}
                <NameSection value={editName} onChange={setEditName} displayName={displayName} onNameChanged={onNameChanged} onSaved={flashSaved} />
                <NotificationsSection settings={settings} tzLabel={tzLabel} patch={patch} openSubView={setSubView}
                  onOpenAccount={() => goBack(() => navigate('/account'))} />
                <AddressSection settings={settings} patch={patch} />
                {!isTherapist && <MyTherapistSection rel={therapy} settings={settings} patch={patch} />}
                {!isTherapist && <BecomeTherapistSection />}
                {isTherapist && <CabinetSection rel={therapy} onOpenTherapistCabinet={onOpenTherapistCabinet} />}
                <PartnerSection pair={pair} />
                <ShareSection /><AboutSection /><DataSection />
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
