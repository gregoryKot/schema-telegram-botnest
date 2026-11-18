import { useEffect } from 'react';
import { api } from '../../api';
import type { ReferenceAnswer } from './guideReferenceAnswer';
import type { ReferenceItem } from './guideReferenceModel';

const KIND = { mode: 'Режим', schema: 'Схема', technique: 'Техника' } as const;
const LINKS = { mode: 'Связанные режимы', schema: 'Связанные схемы', technique: 'Связанные техники' } as const;
const SHEET = { mode: 'Открыть лист режима', schema: 'Открыть лист схемы', technique: 'Открыть лист техники' } as const;
// Показ считается, когда карточка задержалась на экране: лист, мелькнувший посреди набора, — не ответ.
const SHOWN_AFTER_MS = 800;

/**
 * Карточка-ответ над выдачей поиска «Справочника» (модель — guideReferenceAnswer.ts): название листа, текст из него
 * и переходы на сам лист и связанные. Что за лист и какой был запрос — в события не попадает.
 */
export function GuideAnswerCard({ answer, onOpen }: { answer: ReferenceAnswer; onOpen: (item: ReferenceItem) => void }) {
  const { item, intent, text, links } = answer;
  const key = `${item.kind}:${item.id}`;
  useEffect(() => {
    const timer = setTimeout(() => api.trackEvent('cabinet_guide_answer_show'), SHOWN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [key]);
  const follow = (target: ReferenceItem) => {
    api.trackEvent('cabinet_guide_answer_link');
    onOpen(target);
  };
  return (
    <section className="ds-card gr-answer" aria-label="Ответ из справочника">
      <p className="gr-answer-kind">{KIND[item.kind]} · {intent === 'work' ? 'как работать' : 'суть'} · дословно из листа</p>
      <h2 className="gr-answer-name">{item.name}</h2>
      <p className="gr-answer-text">{text}</p>
      <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm gr-answer-sheet" onClick={() => follow(item)}>{SHEET[item.kind]}</button>
      {links.map((group) => (
        <div key={group.kind} className="gr-answer-links" role="group" aria-label={LINKS[group.kind]}>
          <span className="gr-answer-label">{LINKS[group.kind]}</span>
          {group.items.map((target) => (
            <button key={target.id} type="button" className="gr-answer-link" onClick={() => follow(target)}>{target.name}</button>
          ))}
        </div>
      ))}
    </section>
  );
}
