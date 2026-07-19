import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { IntroSheetShell } from './IntroSheetShell';
import { IntroSheetQuestion } from './IntroSheetFlashcard';

const LS_KEY = (id: string) => `schema_intro_${id}`;

const VAR_HEX: Record<string, string> = {
  'var(--accent-red)': '#f87171',
  'var(--accent-orange)': '#fb923c',
  'var(--accent-yellow)': '#facc15',
  'var(--accent-green)': '#34d399',
  'var(--accent-indigo)': '#818cf8',
  'var(--accent-blue)': '#60a5fa',
  'var(--accent)': '#a78bfa',
};

function getSchemaById(id: string) {
  for (const domain of SCHEMA_DOMAINS) {
    const schema = domain.schemas.find((s) => s.id === id);
    if (schema)
      return { ...schema, domainName: domain.domain, color: domain.color };
  }
  return null;
}

export interface SchemaIntroData {
  [key: string]: string;
  triggers: string;
  feelings: string;
  thoughts: string;
  origins: string;
  reality: string;
  healthyView: string;
  behavior: string;
}

const EMPTY: SchemaIntroData = {
  triggers: '',
  feelings: '',
  thoughts: '',
  origins: '',
  reality: '',
  healthyView: '',
  behavior: '',
};

const QUESTIONS: IntroSheetQuestion<SchemaIntroData>[] = [
  {
    key: 'triggers',
    label: 'Что запускает эту схему?',
    hint: 'Ситуации, слова, интонации — типичные триггеры',
    placeholder:
      'Когда не отвечают на сообщения; когда критикуют при других...',
  },
  {
    key: 'feelings',
    label: 'Как проявляется в теле и чувствах?',
    hint: 'Типичные эмоции и ощущения когда схема активна',
    placeholder: 'Тревога и ком в горле; злость и напряжение в груди...',
  },
  {
    key: 'thoughts',
    label: 'Что говорит голос схемы?',
    hint: 'Устойчивые убеждения — про себя, про других, про будущее',
    placeholder: '«Меня никто не ценит», «Я всегда облажаюсь»...',
  },
  {
    key: 'origins',
    label: 'Откуда эта схема пришла?',
    hint: 'Опыт из детства или юности',
    placeholder:
      'Папа говорил что я недостаточно стараюсь; в школе чувствовал себя чужим...',
    optional: true,
  },
  {
    key: 'reality',
    label: 'Что реально, а что говорит схема?',
    hint: 'Факты и доказательства, которые противоречат голосу схемы',
    placeholder:
      'Есть люди которые ценят меня; большинство прогнозов схемы не сбылись...',
  },
  {
    key: 'healthyView',
    label: 'Слова Здорового Взрослого',
    hint: 'Что говорит зрелая, сострадательная часть',
    placeholder:
      '«Эта боль из прошлого, сейчас я в безопасности», «Я достаточно хорош»...',
  },
  {
    key: 'behavior',
    label: 'Что помогает когда схема активна?',
    hint: 'Действия и практики вместо привычных реакций',
    placeholder:
      'Написать что чувствую; позвонить другу; короткая медитация...',
  },
];

interface Props {
  schemaId: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function SchemaIntroSheet({ schemaId, onClose, onComplete }: Props) {
  const tr = useTr();
  const schema = getSchemaById(schemaId);
  if (!schema) return null;

  const colorHex = VAR_HEX[schema.color] ?? '#a78bfa';

  return (
    <IntroSheetShell
      onClose={onClose}
      onComplete={onComplete}
      storageKey={LS_KEY(schemaId)}
      emptyData={EMPTY}
      questions={QUESTIONS}
      loadExisting={() =>
        api.getSchemaNotes().then((notes) => {
          const note = notes.find((n) => n.schemaId === schemaId);
          return note
            ? {
                triggers: note.triggers,
                feelings: note.feelings,
                thoughts: note.thoughts,
                origins: note.origins,
                reality: note.reality,
                healthyView: note.healthyView,
                behavior: note.behavior,
              }
            : null;
        })
      }
      saveNote={(data) => api.saveSchemaNote({ schemaId, ...data })}
      accentColor={colorHex}
      emoji={schema.emoji ?? '●'}
      title={schema.name}
      subtitle={schema.domainName}
      description={schema.desc}
      showDescription
      answerPromptText={tr('Нажми чтобы ответить', 'Нажмите чтобы ответить')}
      nextButtonLabel="Следующий вопрос →"
      gradientSaveButton
    />
  );
}
