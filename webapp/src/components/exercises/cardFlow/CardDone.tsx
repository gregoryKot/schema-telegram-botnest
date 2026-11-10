import { ExBar } from '../ExBar';
import { useExBackLabel } from '../exBackLabel';
import { DoneSheet } from '../../paper/DoneSheet';
import { Sprout } from '../../art/AppScenes';
import { CrisisCard } from '../../CrisisCard';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { glueSpaces } from '../../../../../shared/src/utils/typo';
import type { Q } from '../flashcardQuestions';
import { splitDialogue, type CardSubject } from './cardEntities';
import { CardDialogue } from './CardDialogue';
import '../../../styles/sheet-diary.css';

/** «Карточка сохранена»: лист «готово» (DoneSheet) на бумаге домена схемы или группы режима — знак
 *  с проросшим листом (Sprout, ENTITY_LOOK schema_card/mode_card); «Закрыть» — главная, «Изменить
 *  карточку» — тихая. Ниже — написанное: голос и ответ Здорового Взрослого диалогом, остальное
 *  тихим списком с номером вопроса. «Совета» к заполнению на итоге нет. Кризисный текст в ответах —
 *  карточка поддержки над листом (правило №7). Рамка — ex2-screen с баром упражнения; «Назад» —
 *  goBack экрана (useHistorySheet в SchemaEx/ModeEx, FlashcardEx.tsx). */
export function CardDone({ entity, subject, questions, data, onClose, onEdit }: {
  entity: 'schema_card' | 'mode_card'; subject: CardSubject; questions: Q[];
  data: Record<string, string>; onClose: () => void; onEdit: () => void;
}) {
  const backLabel = useExBackLabel();
  const { voice, healthy, rest } = splitDialogue(questions.map(q => ({ key: q.key, label: q.label, text: data[q.key] ?? '' })));
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const { look } = subject;
  return (
    <div className="ex2-screen">
      <ExBar onBack={onClose} label={backLabel} sticky />
      <div className="sd-done-page ex2-card-done">
        <DoneSheet entity={entity} hue={look.hue} titleAs="h1"
          scene={look.sign ? <Sprout sign={look.sign} hue={look.hue} /> : undefined}
          label={<>Карточка сохранена · {date}</>} title={subject.name}
          primary={{ label: 'Закрыть', onClick: onClose }}
          secondary={{ label: 'Изменить карточку', onClick: onEdit }}
          crisis={detectCrisisAny(...Object.values(data)) ? <CrisisCard surface="flashcard" /> : undefined} />
        <CardDialogue look={look}
          voice={voice && { label: voice.label, text: glueSpaces(voice.text) }}
          healthy={healthy && { label: healthy.label, text: glueSpaces(healthy.text) }} />
        {rest.length > 0 && (
          <section className="ex2-answers" aria-label="Ответы карточки">
            {rest.map(a => (
              <div key={a.key} className="ex2-answer">
                <div className="ds-label ex2-answer-label">{String(a.n).padStart(2, '0')} · {a.label}</div>
                <p className="ex2-answer-text">{glueSpaces(a.text)}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
