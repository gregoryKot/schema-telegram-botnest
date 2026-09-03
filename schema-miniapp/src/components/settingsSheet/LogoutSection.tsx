// «Выйти» — только для веб-хоста (ярлык на экране / вкладка браузера). В
// Telegram/MAX выхода нет и не нужно: вход по initData при каждом запуске
// (см. logout.ts), поэтому здесь секция сама решает не показываться. Стоит в
// блоке «про это устройство и этот вход» (DeviceSections).
import { getHost } from '../../../../shared/src/host';
import { logout } from '../../logout';
import { Row } from './ui';

export function LogoutSection() {
  if (getHost().id !== 'web') return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="card" style={{ borderRadius: 'var(--r-16)', padding: 0 }}>
        {/* «Выйти» — инфинитив: ни рода, ни формы обращения не несёт. */}
        <Row
          label="Выйти"
          color="var(--danger, #e5484d)"
          onClick={() => void logout()}
        />
      </div>
    </div>
  );
}
