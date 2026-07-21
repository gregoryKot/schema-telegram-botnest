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
            // ВРЕМЕННАЯ ДИАГНОСТИКА: понять, почему addToHomeScreen молчит на
            // iOS. Вызываем метод и показываем факты об окружении. Убрать после.
            const tg = window.Telegram?.WebApp;
            let result = 'вызван без ошибки';
            try {
              tg?.addToHomeScreen?.();
            } catch (e) {
              result = 'ОШИБКА: ' + String(e);
            }
            const base =
              `version=${tg?.version}\n` +
              `platform=${tg?.platform}\n` +
              `addToHomeScreen=${typeof tg?.addToHomeScreen}\n` +
              `результат=${result}\n` +
              `checkStatus=${typeof tg?.checkHomeScreenStatus}`;
            if (tg?.checkHomeScreenStatus) {
              tg.checkHomeScreenStatus((s) =>
                tg?.showAlert?.(base + `\nstatus=${s}`),
              );
            } else {
              tg?.showAlert?.(base);
            }
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
