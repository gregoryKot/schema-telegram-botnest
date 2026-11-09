import { MobileNavSkeleton, SectionSkeleton } from '../ShellSkeletons';
import { SidebarSkeleton } from './SidebarSkeleton';
import type { Section } from './navigation';
import { useMarkShellLoading } from '../../hooks/shellLoading';

// Силуэт кабинета на первой загрузке: меню (SidebarSkeleton — клиента или терапевта, свёрнутое или нет),
// верхняя строка, раздел по форме контента (ShellSkeletons — те же силуэты, что у загрузки раздела) и на
// телефоне нижняя панель. До QA 2026-11 (B-З8) здесь был спиннер на пустом бежевом экране — без сайдбара,
// и человек 2–3 секунды не видел, куда попал; до 2026-11 у терапевта — клиентское меню, у раздела — три
// одинаковые серые карточки, на телефоне без панели (два скачка, когда приходили данные).
export function AppShellSkeleton({ section, therapistMode, pathname }: { section: Section; therapistMode: boolean; pathname?: string }) {
  useMarkShellLoading(); // баннер куки ждёт конца загрузки (CookieBanner)
  return (
    <div className="app-shell light-lock" aria-busy="true" data-testid="app-shell-skeleton">
      <SidebarSkeleton therapist={therapistMode} />
      <div className="main">
        <div className="topbar" aria-hidden="true" />
        <div className="canvas">
          <div className="page">
            <SectionSkeleton pathname={pathname ?? (therapistMode ? '/cabinet' : '/' + section)} therapistMode={therapistMode} />
          </div>
        </div>
      </div>
      <MobileNavSkeleton therapist={therapistMode} />
    </div>
  );
}
