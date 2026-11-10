// Голос Здорового Взрослого вставкой мха (ревью g3: было два компонента и два блока CSS — пример на последнем
// шаге дневника режимов и ответ в раскрытой записи ленты): бумага группы «здоровые» со знаком Together
// колонкой слева, подпись ds-label и текст Literata. Вид — modeGroupLook('healthy'), один источник.
// example — пример-ориентир, а не слова человека: текст курсивом.
import type { ReactNode } from 'react';
import { modeGroupLook } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { SignArt } from '../art/SignArt';

const HEALTHY = modeGroupLook('healthy');

export function HealthyVoice({ label, text, example, className }: {
  label: ReactNode; text: ReactNode; example?: boolean; className?: string;
}) {
  const cls = ['pp-paper', 'pa-voice', example && 'pa-voice--example', className].filter(Boolean).join(' ');
  return (
    <div className={cls} style={hueStyle(HEALTHY.hue)}>
      <span className="pa-voice-sign" aria-hidden="true"><SignArt sign={HEALTHY.sign} size="row" /></span>
      <div className="pa-voice-body">
        <div className="ds-label pa-voice-label">{label}</div>
        <div className="pa-voice-text">{text}</div>
      </div>
    </div>
  );
}
