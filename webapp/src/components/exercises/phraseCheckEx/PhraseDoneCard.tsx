import { PhraseSaid } from './PhraseSaid';
import { HealthyVoice } from '../../paper/HealthyVoice';
import { glueSpaces } from '../../../../../shared/src/utils/typo';

// Итог разбора «было → стало» (b18) — две реплики на листе «готово»: голос критика белым листом со знаком
// Looming (PhraseSaid), ответ — вставкой мха со знаком Together (HealthyVoice, тот же голос Здорового
// Взрослого, что в дневнике режимов). Без ответа — одна реплика «Было».
export function PhraseDoneCard({ phrase, rewrite }: { phrase: string; rewrite: string }) {
  const trimmedRewrite = rewrite.trim();
  return (
    <div className="ex2-talk">
      <PhraseSaid label="Было" text={phrase} />
      {trimmedRewrite && <HealthyVoice label="Стало" text={`«${glueSpaces(trimmedRewrite)}»`} />}
    </div>
  );
}
