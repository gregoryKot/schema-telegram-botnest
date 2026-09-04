import { HomeScreenSection } from './HomeScreenSection';
import { LinkAccountSection } from './LinkAccountSection';
import { LogoutSection } from './LogoutSection';

// Блок «про это устройство и этот вход»: значок на экране, перенос данных из
// аккаунта, который у человека уже есть в другом месте, и выход (только на
// веб-хосте — ярлык/вкладка). Все секции сами решают, показываться ли им, —
// SettingsSheet про их условия не знает.
export function DeviceSections() {
  return (
    <>
      <HomeScreenSection />
      <LinkAccountSection />
      <LogoutSection />
    </>
  );
}
