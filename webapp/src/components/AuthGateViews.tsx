// Что видно, пока вход поднимается (RequireAuth, UiPrefsGate), и когда сервер не ответил.
// Загрузка — силуэт того экрана, в который человек откроется (правило «скелетон по форме, спиннер —
// только у кнопок»): кабинет — оболочка AppShellSkeleton, страница аккаунта — колонка листов.
// До 2026-11 — крутилка 28px на пустой бумаге, после неё оболочка появлялась целиком скачком.
// «Сервер не отвечает» — shared ConnectionTrouble в листе исхода «на нашей стороне» (PaperOutcome).
import type { ConnectionTroubleView } from '../../../shared/src/components/ConnectionTrouble';
import { AppShellSkeleton } from './appShell/AppShellSkeleton';
import { sectionFromPath } from './appShell/navigation';
import { PaperOutcome } from './paper/PaperOutcome';
import { ScreenSkeleton } from './Skeleton';

/** Силуэт по адресу: /account* — колонка страницы аккаунта, всё остальное за входом — кабинет. */
export function GateSkeleton({ pathname = window.location.pathname }: { pathname?: string }) {
  if (pathname.startsWith('/account')) {
    return <div className="gate-page" aria-busy="true"><ScreenSkeleton /></div>;
  }
  return <AppShellSkeleton section={sectionFromPath(pathname)} therapistMode={pathname.startsWith('/cabinet')} pathname={pathname} />;
}

/** Оформление ConnectionTrouble на сайте: исход «на нашей стороне», занятая кнопка — «Проверяем…». */
export function ConnectionOutcome({ title, lead, retryLabel, retrying, onRetry }: ConnectionTroubleView) {
  return (
    <PaperOutcome outcome="our_side" title={title} lead={lead}>
      <button type="button" className="ds-btn ds-btn--lg pa-outcome-action" onClick={onRetry}
              disabled={retrying} aria-busy={retrying || undefined}>{retryLabel}</button>
    </PaperOutcome>
  );
}
