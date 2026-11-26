import { useState } from 'react';
import type { QuickActionId } from '../../../../shared/src/quickActions/quickActions';
import { isOverlayQuickAction, type OverlayQuickActionId } from '../quickActions/quickActionRouting';
import type { PlanFocus } from '../plans/planFocus';
import { useSettingsOpen } from '../settingsSheet/settingsLaunch';

type TrackerTab = 'today' | 'history';

// Флаги видимости оверлеев AppShell + их сеттеры. Вынесено из AppShell.tsx (правило №10) — сама логика
// эффектов, завязанных на эти флаги (обновление Today/Profile после закрытия, одноразовый дисклеймер
// терапевта), осталась в родителе: зависит и от другого его состояния (section, therapistMode, userRole).
// «Настройки» открывает и запрос снаружи (общий поиск, settingsLaunch.ts).
export function useOverlays() {
  const [showSettings, setShowSettings] = useSettingsOpen();
  const [showPractices, setShowPractices] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [plansFocus, setPlansFocus] = useState<PlanFocus | null>(null); // план из общего поиска
  const [showSchemaInfo, setShowSchemaInfo] = useState(false);
  const [schemaAutoStartTest, setSchemaAutoStartTest] = useState(false);
  const [schemaInitialTab, setSchemaInitialTab] = useState<'needs'|'schemas'|'modes'>('needs');
  const [schemaHighlight, setSchemaHighlight] = useState<string | undefined>();
  const [showTracker, setShowTracker] = useState(false);
  const [showTrackerOverlay, setShowTrackerOverlay] = useState(false);
  const [trackerNeedId, setTrackerNeedId] = useState<string | null>(null);
  const [trackerTab, setTrackerTab] = useState<TrackerTab>('today');
  const [showDiaries, setShowDiaries] = useState(false);
  const [showChildhoodWheel, setShowChildhoodWheel] = useState(false);
  const [showTodayNote, setShowTodayNote] = useState(false);
  const [showTherapistDisclaimer, setShowTherapistDisclaimer] = useState(false);
  // «Мне плохо» топбара — карточка «Мне плохо» (флэшкарта) поверх текущего раздела.
  const [showSosCard, setShowSosCard] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  // Быстрое действие «+»/⌘K, открытое оверлеем (дневники, разбор, практики).
  const [quickAction, setQuickAction] = useState<OverlayQuickActionId | null>(null);

  // Один вход для «+» и палитры: трекер — своим флагом, остальное — оверлеем.
  const runQuickAction = (id: QuickActionId) => {
    if (id === 'tracker') { setTrackerNeedId(null); setShowTrackerOverlay(true); }
    else if (isOverlayQuickAction(id)) setQuickAction(id);
  };
  const openSchema = (opts?: { startTest?: boolean; tab?: 'needs' | 'schemas' | 'modes'; highlight?: string }) => {
    setSchemaAutoStartTest(!!opts?.startTest);
    setSchemaInitialTab(opts?.tab ?? 'needs');
    setSchemaHighlight(opts?.highlight);
    setShowSchemaInfo(true);
  };

  return {
    showSettings, setShowSettings,
    showPractices, setShowPractices,
    showPlans, setShowPlans, plansFocus, setPlansFocus,
    showSchemaInfo, setShowSchemaInfo,
    schemaAutoStartTest, setSchemaAutoStartTest,
    schemaInitialTab,
    schemaHighlight, setSchemaHighlight,
    showTracker, setShowTracker,
    showTrackerOverlay, setShowTrackerOverlay,
    trackerNeedId, setTrackerNeedId,
    trackerTab, setTrackerTab,
    showDiaries, setShowDiaries,
    showChildhoodWheel, setShowChildhoodWheel,
    showTodayNote, setShowTodayNote,
    showTherapistDisclaimer, setShowTherapistDisclaimer,
    showSosCard, setShowSosCard,
    cmdOpen, setCmdOpen,
    quickAction, setQuickAction, runQuickAction, openSchema,
  };
}
