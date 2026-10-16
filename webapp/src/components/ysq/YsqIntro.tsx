import { YsqDisclaimer } from '../../../../shared/src/components/YsqDisclaimer';
import { YsqSyncErrorNote } from '../../../../shared/src/components/YsqSyncErrorNote';
import { SsHead } from '../schemaSheets/SsSheet';

type Tr = (ty: string, vy: string) => string;

interface Props {
  tr: Tr;
  hasProgress: boolean;
  progressAnswered: number;
  resumeCheckFailed?: boolean;
  retryResumeCheck?: () => void;
  onContinue: () => void;
  onStartFresh: () => void;
  onCancel: () => void;
}

/** Интро теста YSQ: что за тест, шкала ответов, старт/продолжение. */
export function YsqIntro({ tr, hasProgress, progressAnswered, resumeCheckFailed, retryResumeCheck, onContinue, onStartFresh, onCancel }: Props) {
  const facts = [
    ['116 утверждений', tr('Оцени каждое от 1 до 6', 'Оцените каждое от 1 до 6')],
    ['~10 минут', 'Можно прервать — прогресс сохраняется'],
    ['20 схем', 'Результат с описанием и советом для каждой'],
  ];
  return (
    <>
      <SsHead center title="Тест на схемы" lede="Паттерны мышления и поведения, сложившиеся в детстве" />

      <div className="ss-facts">
        {facts.map(([title, desc]) => (
          <div key={title} className="ss-fact">
            <b>{title}</b>
            <span>{desc}</span>
          </div>
        ))}
      </div>

      <div className="ds-card ss-card-stack">
        <div className="ds-label">Шкала ответов</div>
        <div className="ss-legend">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n}>
              <div className={`ss-legend-n${n >= 4 ? ' is-high' : ''}`}>{n}</div>
              <div className="ss-legend-t">{n === 1 ? 'Совсем не про меня' : n === 6 ? 'Полностью про меня' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="ss-note">Ответы привязаны к аккаунту и не передаются третьим лицам.</p>

      {!hasProgress && resumeCheckFailed && retryResumeCheck && <YsqSyncErrorNote variant="resume-check" onRetry={retryResumeCheck} />}
      <div className="ss-actions">
        {hasProgress ? (
          <>
            <button onClick={onContinue} className="ds-btn">Продолжить ({progressAnswered} из 116)</button>
            <button onClick={onStartFresh} className="ds-btn ds-btn--secondary">Начать заново</button>
          </>
        ) : (
          <button onClick={onStartFresh} className="ds-btn">Начать тест</button>
        )}
        <button onClick={onCancel} className="ds-btn ds-btn--secondary">Отмена</button>
      </div>

      <YsqDisclaimer mt={4} />
    </>
  );
}
