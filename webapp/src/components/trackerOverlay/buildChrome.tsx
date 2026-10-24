import type { Need } from '../../types';
import { TrackerFooter, TrackerTopbar } from './TrackerChrome';
import { MobileFooter, MobileTopbar } from './MobileChrome';
import { TrackerOnboarding } from './TrackerOnboarding';

interface ChromeArgs {
  isDesktop: boolean;
  isBackfill: boolean;
  date?: string;
  goBack: () => void;
  onOpenNote?: () => void;
  onOpenHistory?: () => void;
  needs: Need[];
  idx: number;
  setIdx: (i: number) => void;
  allRated: boolean;
  lastSavedAt: Date | null;
  effectiveRatings: Record<string, number>;
  ratings: Record<string, number>;
  nameOf: (n: Need) => string;
  onFinish: () => void;
}

/** Шапка, низ и онбординг трекера: на десктопе — редакционные, на телефоне — компактные (tkm-*). */
export function buildChrome(a: ChromeArgs) {
  const { isDesktop, isBackfill, date, goBack, onOpenNote, onOpenHistory, needs, idx, setIdx, effectiveRatings } = a;
  const onboarding = <TrackerOnboarding eligible={!isBackfill && Object.keys(a.ratings).length === 0} />;
  const barProps = { isBackfill, date, goBack, onOpenNote, onOpenHistory };
  const topbar = isDesktop ? (
    <>
      <TrackerTopbar {...barProps} isDesktop />
      {onboarding}
    </>
  ) : (
    <MobileTopbar {...barProps} />
  );
  const footerProps = {
    idx,
    needs,
    allRated: a.allRated,
    lastSavedAt: a.lastSavedAt,
    onPrev: () => idx > 0 && setIdx(idx - 1),
    onNext: () => setIdx(idx + 1),
    onFinish: a.onFinish,
    onToEmpty: () => {
      const f = needs.findIndex((n) => !(effectiveRatings[n.id] ?? 0));
      if (f >= 0) setIdx(f);
    },
  };
  const footer = isDesktop ? <TrackerFooter needName={a.nameOf} {...footerProps} /> : <MobileFooter {...footerProps} />;
  return { topbar, footer, onboarding };
}
