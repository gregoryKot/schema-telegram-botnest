// Фраза, которую разбирают (b18), — реплика голоса критика: белый лист с тенью-слоем сливы, Literata курсивом.
// Без подписи — крупно наверху шага приметы (фразу разбирают, а не читают мелкой метой); с подписью «Было» —
// строкой со знаком Looming над «Стало» (HealthyVoice) на шаге «переписать», в итоге и в листе прошлого разбора.
import type { ReactNode } from 'react';
import { SignArt } from '../../art/SignArt';
import { hueStyle } from '../../../lib/tone';
import { CRITIC_LOOK } from './phraseLook';
import { glueSpaces } from '../../../../../shared/src/utils/typo';

export function PhraseSaid({ text, label }: { text: string; label?: ReactNode }) {
  return (
    <figure className={label ? 'ex2-said ex2-said--was' : 'ex2-said'} style={hueStyle(CRITIC_LOOK.hue)}>
      {label && (
        <figcaption className="ds-label ex2-said-label">
          <SignArt sign={CRITIC_LOOK.sign} size="nav" />
          {label}
        </figcaption>
      )}
      <blockquote className="ex2-said-text">«{glueSpaces(text)}»</blockquote>
    </figure>
  );
}
