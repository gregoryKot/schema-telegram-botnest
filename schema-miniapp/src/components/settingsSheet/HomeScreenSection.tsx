import { useState } from 'react';
import { Row, SettingsLabel, RowRight } from './ui';
import {
  canOfferHomeScreenNow,
  getOfferMemory,
  resetHomeScreenOffer,
} from '../../utils/homeScreen';
import { useHomeScreenOffer } from '../../hooks/useHomeScreenOffer';

// Значок на экране — из настроек. Нужен на два случая: человек отказался
// «не предлагать», а потом передумал; и человек хочет добавить значок сам,
// не дожидаясь напоминания.
export function HomeScreenSection() {
  const offer = useHomeScreenOffer('settings');
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
          onClick={offer.add}
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
