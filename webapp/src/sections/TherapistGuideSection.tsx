import { useEffect, useState } from 'react';
import { api } from '../api';
import { Layers } from '../components/art/PaperArt';
import { GuideReference } from './guide/GuideReference';

/**
 * «Справочник» в меню терапевта (#995, шаг 4, /cabinet/guide): те же разделы
 * режимов, схем и техник, что открываются из схемы случая клиента, только без
 * клиента — без «Дать заданием», отметок и истории. Строка под заголовком
 * отвечает «откуда это и зачем» до первого тапа. Тексты — отдельный чанк
 * (guideLoader): не доехал — «Повторить» монтирует список заново, и загрузка
 * начинается сначала. Событие открытия — cabinet_guide_open
 * (src/analytics/cabinet-events.constants.ts), без меты.
 */
export function TherapistGuideSection() {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { api.trackEvent('cabinet_guide_open'); }, []);
  return (
    <div className="ds-page animate-fade" style={{ maxWidth: 820 }}>
      <div className="pp-block pp-block--head">
        <div className="pp-hero">
          <div className="pp-hero-body">
            <div className="ds-label">Практика</div>
            <h1 className="pp-hero-title">Справочник</h1>
            <p className="pp-hero-text">
              Что обычно делают с каждой схемой и каждым режимом — по книгам схема-терапии.
              Те же подсказки — в концептуализации клиента
            </p>
          </div>
          <Layers size="hero" />
        </div>
      </div>
      <GuideReference key={attempt} onRetry={() => setAttempt((a) => a + 1)} />
    </div>
  );
}
