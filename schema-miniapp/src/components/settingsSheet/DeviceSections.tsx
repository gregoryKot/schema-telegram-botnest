import { HomeScreenSection } from './HomeScreenSection';
import { LinkAccountSection } from './LinkAccountSection';

// Блок «про это устройство и этот вход»: значок на экране и перенос данных из
// аккаунта, который у человека уже есть в другом месте. Обе секции сами решают,
// показываться ли им, — SettingsSheet про их условия не знает.
export function DeviceSections() {
  return (
    <>
      <HomeScreenSection />
      <LinkAccountSection />
    </>
  );
}
