import type { ReactNode } from 'react';
import { SignArt } from '../../art/SignArt';
import { HealthyVoice } from '../../paper/HealthyVoice';
import type { SignKey } from '../../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../../lib/tone';

interface Line { label: ReactNode; text: ReactNode }

/** Диалог двух голосов (портрет режима, итог карточки схемы и режима): реплика схемы или режима —
 *  цитатой Literata на бумаге его домена или группы со знаком справа, ответ Здорового Взрослого —
 *  вставкой мха с Together (HealthyVoice, тот же голос, что в дневнике режимов) со сдвигом вправо:
 *  разговор виден формой, а не только подписями. Пустой голос не рисуется. */
export function CardDialogue({ look, voice, healthy }: { look: { hue: number; sign?: SignKey }; voice?: Line; healthy?: Line }) {
  if (!voice && !healthy) return null;
  return (
    <div className="ex2-dialog">
      {voice && (
        <figure className="pp-paper ex2-voice" style={hueStyle(look.hue)}>
          <figcaption className="ds-label ex2-voice-label">{voice.label}</figcaption>
          <blockquote className="ex2-voice-text">{voice.text}</blockquote>
          {look.sign && <span className="ex2-voice-sign" aria-hidden="true"><SignArt sign={look.sign} size="row" /></span>}
        </figure>
      )}
      {healthy && <HealthyVoice className="ex2-dialog-reply" label={healthy.label} text={healthy.text} />}
    </div>
  );
}
