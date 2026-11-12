import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/sheet-settings.css';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api, type UserSettings } from '../api';
import { SettingsSkeleton } from './settingsSheet/SettingsSkeleton';
import { useSaveBadge } from './settingsSheet/useSaveBadge';
import { SaveBadge } from './settingsSheet/SaveBadge';
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
import { SettingsSubScreen } from './settingsSheet/SubScreen';
import { useSubViewNav } from './settingsSheet/useSubViewNav';
import { NotificationsSection } from './settingsSheet/NotificationsSection';
import { NameSection, AddressSection } from './settingsSheet/NameAddressSections';
import { MyTherapistSection, CabinetSection } from './settingsSheet/TherapistSections';
import { PartnerSection } from './settingsSheet/PartnerSection';
import { ShareSection, AboutSection } from './settingsSheet/ShareAboutSections';
import { HomeScreenSection } from './settingsSheet/HomeScreenSection';
import { homeIconMode } from './settingsSheet/homeIconMode';
import { settingsNav } from './settingsSheet/settingsNav';

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
  const sub = useSubViewNav();
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

  /** Сохранить настройки; исход — сохранилось ли (отказ уже откатил `settings` и показал «Не сохранилось»). */
  async function patch(update: Partial<UserSettings>): Promise<boolean> {
    if (!settings) return false;
    const prev = settings; setSettings(s => s ? { ...s, ...update } : s);
    try { await api.updateSettings(update); flashSaved(); return true; }
    catch { setSettings(prev); flashSaveError(); return false; }
  }
  const reloadSettings = () => api.getSettings().then(setSettings, (e: unknown) => console.warn('настройки не перечитались', e)); // после веб-пушей: новый notifyChannel

  const scrollTo = (id: string) => scrollIntoViewSafe(document.getElementById(id), { block: 'start' });

  const isTherapist = userRole === 'THERAPIST';
  const canSwitchMode = isTherapist && onSetTherapistMode;
  const homeMode = homeIconMode();
  const navItems = settingsNav({ therapist: isTherapist, modeSwitch: !!canSwitchMode, homeIcon: !!homeMode });

  const badge = <SaveBadge on={badgeOn} outcome={outcome} />;

  // Один корень листа и одна шапка на загрузку и готовый вид: фокус, поставленный useDialogA11y на
  // «← Закрыть», не теряется, когда силуэт сменяется содержимым. Подэкран — свой уровень (SubScreen).
  return (
    <>
      <div {...dialogA11y} className="settings-overlay st-overlay">
        {settings && sub.view !== 'main' ? (
          <SettingsSubScreen key={sub.view} title={SUB_TITLES[sub.view]} badge={badge} onClose={sub.close}>
            {(done) => <SettingsSubView subView={sub.view as Exclude<SubView, 'main'>} settings={settings} patch={patch} onDone={done} />}
          </SettingsSubScreen>
        ) : (<>
          {/* Шапка: «назад» и статус сохранения; заголовок вида — в теле (в шапке на 320–390 он резался) */}
          <div className="ds-sheet-head">
            <button type="button" className="ds-back" onClick={goBack}>← Закрыть</button>
            {badge}
          </div>
          {!settings ? <SettingsSkeleton navRows={navItems.length} /> : (
            <div className="st-body">
              <div className="settings-sidenav">
                {navItems.map(n => (
                  <button key={n.id} data-target={n.id} onClick={() => scrollTo(n.id)} className="settings-sidenav-item st-navitem">
                    {n.label}
                  </button>
                ))}
              </div>
              <div className="st-scroll" ref={sub.scrollRef}>
                <div className="settings-content-inner st-inner">
                  <h2 className="ds-h2 st-h">{SUB_TITLES.main}</h2>
                  {canSwitchMode && <ModeSection therapistMode={!!therapistMode}
                    onSelect={(on) => goBack(() => onSetTherapistMode(on))} onOpenAccount={() => goBack(() => navigate('/account'))} />}
                  <NameSection value={editName} onChange={setEditName} displayName={displayName} onNameChanged={onNameChanged} onSaved={flashSaved} />
                  <AddressSection settings={settings} patch={patch} />
                  <NotificationsSection settings={settings} tzLabel={timezoneLabel(settings.notifyTimezone)} patch={patch} openSubView={sub.open}
                    leaveTo={(path) => goBack(() => navigate(path))} reloadSettings={reloadSettings} />
                  <AppearanceSection onSaved={flashSaved} />
                  {homeMode && <HomeScreenSection mode={homeMode} />}
                  {!isTherapist && <MyTherapistSection rel={therapy} settings={settings} patch={patch} />}
                  {isTherapist && <CabinetSection rel={therapy} onOpenTherapistCabinet={onOpenTherapistCabinet} />}
                  <PartnerSection pair={pair} />
                  <ShareSection />
                  {!isTherapist && <BecomeTherapistSection />}
                  <AboutSection />
                  <DataSection onResign={canSwitchMode ? onResignTherapist : undefined} />
                </div>
              </div>
            </div>
          )}
        </>)}
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
