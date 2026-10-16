import type { ModeMapNode } from '../../api';
import '../../styles/sheet-modemap.css';
import { MMIcon } from '../modeMapIcons';
import { useTr } from '../../utils/addressForm';
import { conceptQuestions } from './conceptQuestions';

// Клинические вопросы по типу ноды + блок «Спросить себя» (вынесено из ModeMapNodeEditor.tsx, правило №10).
type Question = { text: string; target: 'note' | 'need' | 'healthy' };
// Type-specific clinical questions. `target` says which field the question guides — clicking it focuses that field.
function clinicalQuestions(node: ModeMapNode): Question[] {
  const sub = node.data.copingSubtype;
  const note = (text: string): Question => ({ text, target: 'note' });
  const need = (text: string): Question => ({ text, target: 'need' });
  const heal = (text: string): Question => ({ text, target: 'healthy' });
  switch (node.type) {
    case 'trigger':
      return [note('Что конкретно произошло?'), note('Что клиент увидел, услышал, вспомнил?')];
    case 'child':
      return [note('Что чувствует эта часть?'), need('Какая детская потребность не удовлетворена?'), heal('Что сказал бы ребёнку Здоровый Взрослый?')];
    case 'critic':
      return [note('Чей это голос?'), note('Что говорит дословно?'), heal('Что ответил бы критику Здоровый Взрослый?')];
    case 'coping':
      if (sub === 'avoid')  return [note('От чего уводит?'), note('Какую боль ребёнка прячет?'), heal('Что сказал бы Здоровый Взрослый?')];
      if (sub === 'surr')   return [note('Кому подчиняется?'), note('Какую боль ребёнка прячет?'), heal('Что сказал бы Здоровый Взрослый?')];
      return [note('От какой боли защищает?'), note('Какую цену клиент платит?'), heal('Что сказал бы Здоровый Взрослый?')];
    case 'healthy':
      return [note('Кого защищает?'), note('Кому ставит границы?'), need('Какие потребности удовлетворяет?')];
    case 'behavior':
      return [note('Что конкретно делает клиент?'), note('К каким последствиям это ведёт?')];
    default: {
      const own = conceptQuestions(node.type);
      return (own ?? ['Как этот режим проявляется?', 'Что он делает в поведении?']).map(note);
    }
  }
}

export function ClinicalHint({ node, onPickNote, onPickNeed, onPickHealthy }: {
  node: ModeMapNode; onPickNote: () => void; onPickNeed: () => void; onPickHealthy: () => void;
}) {
  const tr = useTr();
  const qs = clinicalQuestions(node);
  return (
    <div className="mm2-hint">
      <div className="ds-label">
        <MMIcon name="bulb" size={13} /> Спросить себя
      </div>
      <div>
        {qs.map((q, i) => (
          <button key={i}
            onClick={() => (q.target === 'need' ? onPickNeed() : q.target === 'healthy' ? onPickHealthy() : onPickNote())}
            title={tr('Нажми, чтобы заполнить поле', 'Нажмите, чтобы заполнить поле')}
            className="mm2-hint-q">
            <span>→</span>{q.text}
          </button>
        ))}
      </div>
    </div>
  );
}
