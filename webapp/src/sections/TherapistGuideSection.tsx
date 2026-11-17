import { useEffect, useState } from 'react';
import { api } from '../api';
import { Layers } from '../components/art/PaperArt';
import { GuideReference } from './guide/GuideReference';
import { useHostId } from '../host/useHostId';
import { useTr } from '../../../shared/src/utils/addressForm';
import { supportContact } from '../../../shared/src/utils/supportContact';

/**
 * «Справочник» в меню терапевта (#995, шаг 4, /cabinet/guide): те же разделы
 * режимов, схем и техник, что открываются из схемы случая клиента, только без
 * клиента — без «Дать заданием», отметок и истории. Строка под заголовком
 * отвечает «откуда это и зачем» до первого тапа. Тексты — отдельный чанк
 * (guideLoader): не доехал — «Повторить» монтирует список заново, и загрузка
 * начинается сначала. Событие открытия — cabinet_guide_open
 * (src/analytics/cabinet-events.constants.ts), без меты. Под ней — оговорка, что тексты собраны из
 * разных источников, и куда написать об ошибке (supportContact: в MAX — почта, иначе Telegram).
 */
export function TherapistGuideSection() {
  const [attempt, setAttempt] = useState(0);
  const tr = useTr();
  const contact = supportContact(useHostId());
  useEffect(() => { api.trackEvent('cabinet_guide_open'); }, []);
  return (
    <div className="ds-page animate-fade">
      <div className="pp-block pp-block--head">
        <div className="pp-hero">
          <div className="pp-hero-body">
            <div className="ds-label">Практика</div>
            <h1 className="pp-hero-title">Справочник</h1>
            <p className="pp-hero-text">
              Что обычно делают с каждой схемой и каждым режимом — по книгам схема-терапии.
              Те же подсказки — в концептуализации клиента
            </p>
            <p className="ds-sub gr-note">
              {tr(
                'Тексты собраны из книг и статей по схема-терапии и могут содержать ошибки. Нашлась ошибка или неточность — обязательно напиши: ',
                'Тексты собраны из книг и статей по схема-терапии и могут содержать ошибки. Нашлась ошибка или неточность — обязательно напишите: ',
              )}
              <a href={contact.url} target="_blank" rel="noopener noreferrer" className="u-accent">{contact.label}</a>
            </p>
          </div>
          <Layers size="hero" />
        </div>
      </div>
      <GuideReference key={attempt} onRetry={() => setAttempt((a) => a + 1)} />
    </div>
  );
}
