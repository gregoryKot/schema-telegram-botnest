import { getModeById } from '../schemaTherapyData';
import { api } from '../api';
import { IntroSheetShell } from './IntroSheetShell';
import { IntroSheetQuestion } from './IntroSheetFlashcard';

const STORAGE_KEY = (modeId: string) => `mode_intro_${modeId}`;

interface IntroData {
  [key: string]: string;
  triggers: string;
  feelings: string;
  thoughts: string;
  needs: string;
  behavior: string;
}

const EMPTY: IntroData = {
  triggers: '',
  feelings: '',
  thoughts: '',
  needs: '',
  behavior: '',
};

const QUESTIONS: IntroSheetQuestion<IntroData>[] = [
  {
    key: 'triggers',
    label: 'Когда активируется',
    hint: 'Ситуации, люди, слова — что запускает этот режим?',
    placeholder: 'Когда меня критикуют, когда нужно выступить...',
  },
  {
    key: 'feelings',
    label: 'Что чувствую',
    hint: 'Эмоции и ощущения в теле',
    placeholder: 'Тревога, комок в горле, напряжение в плечах...',
  },
  {
    key: 'thoughts',
    label: 'Что говорит внутри',
    hint: 'Убеждения, голос, монолог этого режима',
    placeholder: '«Я недостаточно хорош», «Лучше не рисковать»...',
  },
  {
    key: 'needs',
    label: 'Чего на самом деле хочет',
    hint: 'Глубинная потребность за этим режимом',
    placeholder: 'Безопасности, признания, контакта...',
  },
  {
    key: 'behavior',
    label: 'Как проявляется в поведении',
    hint: 'Что происходит в поведении в этом режиме',
    placeholder: 'Замолкаю, избегаю, злюсь, переусердствую...',
  },
];

interface Props {
  modeId: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function ModeIntroSheet({ modeId, onClose, onComplete }: Props) {
  const mode = getModeById(modeId);
  if (!mode) return null;

  return (
    <IntroSheetShell
      onClose={onClose}
      onComplete={onComplete}
      storageKey={STORAGE_KEY(modeId)}
      emptyData={EMPTY}
      questions={QUESTIONS}
      loadExisting={() =>
        api.getModeNotes().then((notes) => {
          const note = notes.find((n) => n.modeId === modeId);
          return note
            ? {
                triggers: note.triggers,
                feelings: note.feelings,
                thoughts: note.thoughts,
                needs: note.needs,
                behavior: note.behavior,
              }
            : null;
        })
      }
      saveNote={(data) => api.saveModeNote({ modeId, ...data })}
      accentColor={mode.groupColor ?? 'var(--accent)'}
      emoji={mode.emoji}
      title={mode.name}
      subtitle={mode.groupName}
      description={mode.short}
      showDescription={Boolean(mode.short)}
      answerPromptText="Нажми чтобы ответить"
      nextButtonLabel="Следующий →"
    />
  );
}
