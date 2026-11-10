import { YsqDisclaimer } from '../../../../shared/src/components/YsqDisclaimer';
import { YsqSyncNote } from './YsqSyncNote';
import { TherapyCaution } from '../therapy/TherapyCaution';
import { EntitySheet } from '../paper/EntitySheet';
import { YsqQuizScene } from './YsqQuizScene';

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

/** Интро теста YSQ: герой со сценой (лист глины, веер вопросов с Layers), три факта одной карточкой, шкала,
 *  старт/продолжение — одна залитая кнопка; «самопомощь» наклейкой под кнопками (APP_2026-11.md, принцип 5). */
export function YsqIntro({ tr, hasProgress, progressAnswered, resumeCheckFailed, retryResumeCheck, onContinue, onStartFresh, onCancel }: Props) {
  const facts = [
    ['116 утверждений', tr('Оцени каждое от 1 до 6', 'Оцените каждое от 1 до 6')],
    ['~10 минут', 'Можно прервать — прогресс сохраняется'],
    ['20 схем', 'Результат с описанием и советом для каждой'],
  ];
  return (
    <>
      <EntitySheet look="ysq" title="Тест на схемы" sub="Паттерны мышления и поведения, сложившиеся в детстве"
        art={<YsqQuizScene />} titleAs="h1" className="ss-hero ss-ysq-hero" />
      <div className="ss-facts">
        {facts.map(([title, desc]) => (
          <div key={title} className="ss-fact"><b>{title}</b><span>{desc}</span></div>
        ))}
      </div>

      <div className="ds-card ss-card-stack ss-legend-card">
        <div className="ds-label">Шкала ответов</div>
        <div className="ss-legend">
          {[1, 2, 3, 4, 5, 6].map(n => <div key={n} className={`ss-legend-n${n >= 4 ? ' is-high' : ''}`}>{n}</div>)}
          <div className="ss-legend-t">Совсем не про меня</div><div className="ss-legend-t">Полностью про меня</div>
        </div>
      </div>

      {!hasProgress && resumeCheckFailed && retryResumeCheck && <YsqSyncNote variant="resume-check" onRetry={retryResumeCheck} />}
      <div className="ss-actions ss-actions--wide">
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
      <TherapyCaution place="test_start" compact />

      <p className="ss-note">Ответы привязаны к аккаунту и не передаются третьим лицам.</p>
      <YsqDisclaimer mt={4} />
    </>
  );
}
