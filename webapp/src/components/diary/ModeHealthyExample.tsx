import { healthyAdultHint } from '../../../../shared/src/mode/healthyAdultHints';
import { HealthyVoice } from '../paper/HealthyVoice';

/**
 * Пример-ориентир на последнем шаге дневника режимов (слова Здорового Взрослого этому режиму) —
 * явно «пример», не ответ. Вставка голоса Здорового Взрослого (HealthyVoice — та же, что ответ в
 * раскрытой записи ленты): лист мха со знаком группы здоровых режимов (Together). Поле ответа
 * остаётся в ModeEntryForm — там его прогоняет detectCrisisAny (правило №7).
 */
export function ModeHealthyExample({ modeId }: { modeId: string }) {
  return <HealthyVoice label="Например, можно сказать себе:" text={healthyAdultHint(modeId)} example className="sd-example" />;
}
