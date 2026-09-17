import { useEffect, useState, lazy, Suspense } from 'react';
import { api } from '../../api';
import type { UserProfile } from '../../types';
import { CaseEntryCard } from './CaseEntryCard';
import { OnboardingWidget } from './OnboardingWidget';

// Ленивые чанки (по образцу SchemaEx/ModeEx выше в TodaySection.tsx и
// параллельного схлопывания в schema-miniapp, правило CLAUDE.md про
// бандл-храповик): десять экранов потока и карта себя открываются по явному
// тапу, а не при каждом заходе на /today — не должны утяжелять чанк раздела.
const CaseFlowScreen = lazy(() =>
  import('../../components/caseFlow/CaseFlowScreen').then((m) => ({
    default: m.CaseFlowScreen,
  })),
);
const SelfMapOverlay = lazy(() =>
  import('../../components/selfMap/SelfMapOverlay').then((m) => ({
    default: m.SelfMapOverlay,
  })),
);

/**
 * Точка входа в разбор случая на /today + условный показ онбординга
 * «С чего начать» — ТОЛЬКО после первого разбора (правило CLAUDE.md: одно
 * очевидное действие у новичка, а не две конкурирующие точки входа). Twin
 * schema-miniapp/src/sections/TodaySection.tsx (там caseCount/CaseEntryCard/
 * онбординг живут прямо в секции — здесь вынесены в отдельный файл, чтобы не
 * растить TodaySection.tsx сверх зафиксированного в file-size-baseline.json
 * размера, правило №10).
 *
 * caseCount грузится своим собственным вызовом (не переиспользует
 * Promise.all TodaySection.tsx) — та же независимость, что у миниапповского
 * CaseFlowOverlay: держать состояние экрана и открытие потока в одном месте
 * важнее одного лишнего GET-а на /api/diary/mode.
 */
export function CaseEntryBlock({
  profile,
  hasSchemas,
  onOpenSchema,
  onOpenAdvanced,
  onOpenTracker,
  onOpenDiaries,
  onOpenChildhoodWheel,
}: {
  profile: UserProfile | null;
  hasSchemas: boolean;
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs' | 'schemas' | 'modes'; highlight?: string }) => void;
  onOpenAdvanced: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
}) {
  const [caseCount, setCaseCount] = useState<number | null>(null);
  const [showFlow, setShowFlow] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const load = () => {
    api
      .getModeDiary()
      .then((rows) => setCaseCount(rows.length))
      .catch((e) => console.error('case count load failed', e));
  };
  useEffect(load, []);

  return (
    <>
      <CaseEntryCard
        caseCount={caseCount ?? 0}
        onStart={() => setShowFlow(true)}
        onSteadyDay={onOpenTracker}
        onOpenMap={() => setShowMap(true)}
      />

      {!!caseCount && (
        <OnboardingWidget
          profile={profile}
          hasSchemas={hasSchemas}
          onOpenSchema={onOpenSchema}
          onOpenAdvanced={onOpenAdvanced}
          onOpenTracker={onOpenTracker}
          onOpenDiaries={onOpenDiaries}
          onOpenChildhoodWheel={onOpenChildhoodWheel}
        />
      )}

      {showFlow && (
        <Suspense fallback={null}>
          <CaseFlowScreen
            caseCount={caseCount ?? 0}
            onSave={async (data) => {
              await api.createModeDiary(data);
            }}
            onSaveCard={async (body) => {
              await api.saveModeNote(body);
            }}
            onSteadyDay={onOpenTracker}
            onOpenMap={() => {
              setShowFlow(false);
              setShowMap(true);
            }}
            onClose={() => {
              setShowFlow(false);
              load();
            }}
            onDoubt={() => {}}
          />
        </Suspense>
      )}

      {showMap && (
        <Suspense fallback={null}>
          <SelfMapOverlay
            onClose={() => setShowMap(false)}
            onStartCase={() => {
              setShowMap(false);
              setShowFlow(true);
            }}
            onOpenTracker={onOpenTracker}
            onOpenSchema={onOpenSchema}
          />
        </Suspense>
      )}
    </>
  );
}
