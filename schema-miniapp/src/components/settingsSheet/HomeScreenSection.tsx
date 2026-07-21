import { useState } from 'react';
import { Row, SettingsLabel, RowRight } from './ui';
import {
  canOfferHomeScreenNow,
  getOfferMemory,
  resetHomeScreenOffer,
} from '../../utils/homeScreen';
// Значок на экране — из настроек. Нужен на два случая: человек отказался
// «не предлагать», а потом передумал; и человек хочет добавить значок сам,
// не дожидаясь напоминания.
export function HomeScreenSection() {
  const [memory, setMemory] = useState(getOfferMemory);

  // Платформа не поддерживает (десктоп, веб) — строки просто нет.
  if (!canOfferHomeScreenNow()) return null;

  const declined = memory.kind === 'never';

  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ЗНАЧОК НА ЭКРАНЕ</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <Row
          emoji="📲"
          label="Добавить значок"
          sub="открывать приложение с экрана телефона"
          onClick={() => {
            // ВРЕМЕННАЯ ДИАГНОСТИКА. showAlert СИНХРОННО первым — чтобы окошко
            // точно выскочило и подтвердило, что клик доходит (прошлая версия
            // прятала showAlert в колбэк checkHomeScreenStatus, который на iOS
            // не вызывается — окошка не было). Убрать после диагностики.
            const tg = window.Telegram?.WebApp;
            const info =
              `version=${tg?.version}\n` +
              `platform=${tg?.platform}\n` +
              `addToHomeScreen=${typeof tg?.addToHomeScreen}\n` +
              `showAlert=${typeof tg?.showAlert}\n` +
              `checkStatus=${typeof tg?.checkHomeScreenStatus}`;
            // Сначала показываем факты (подтверждает, что клик дошёл), потом
            // пробуем сам вызов.
            if (tg?.showAlert) tg.showAlert(info);
            else alert(info);
            let result = 'вызван без ошибки';
            try {
              tg?.addToHomeScreen?.();
            } catch (e) {
              result = 'ОШИБКА: ' + String(e);
            }
            // результат вызова — отдельным окошком после
            const after = `addToHomeScreen(): ${result}`;
            if (tg?.showAlert) tg.showAlert(after);
            else alert(after);
          }}
          divider={declined}
        />
        {declined && (
          <Row
            emoji="🔔"
            label="Вернуть напоминание"
            sub="сейчас напоминание отключено"
            right={<RowRight text="Включить" small />}
            onClick={() => {
              resetHomeScreenOffer();
              setMemory(getOfferMemory());
            }}
          />
        )}
      </div>
    </div>
  );
}
