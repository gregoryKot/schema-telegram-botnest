import { useState } from 'react';
import { getModeById } from '../schemaTherapyData';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { IntroSheetShell } from './IntroSheetShell';
import { HeaderInfoButton } from './IntroSheetHeader';
import { buildModeIntroExplainer } from '../../../shared/src/mode/modeFlowExplainers';
import { buildModeIntroQuestions } from '../../../shared/src/mode/modeIntroQuestions';
import { getModeCard } from '../../../shared/src/mode/modeCards';
import { MODE_CARD_SAVED_EVENT } from '../../../shared/src/share/analytics';
import { ModePortrait } from './modeIntro/ModePortrait';

const STORAGE_KEY = (modeId: string) => `mode_intro_${modeId}`;
const SEEN_KEY = (modeId: string) => `mode_portrait_seen_${modeId}`;

interface IntroData {
  [key: string]: string;
  triggers: string;
  feelings: string;
  thoughts: string;
  behavior: string;
  needs: string;
  origins: string;
  healthyView: string;
}

const EMPTY: IntroData = {
  triggers: '',
  feelings: '',
  thoughts: '',
  behavior: '',
  needs: '',
  origins: '',
  healthyView: '',
};

interface Props {
  modeId: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function ModeIntroSheet({ modeId, onClose, onComplete }: Props) {
  const tr = useTr();
  const mode = getModeById(modeId);
  const card = getModeCard(modeId);
  // seen — портрет уже показывали: не открывать его снова автоматически,
  // но честно подписать кнопку при ручном возврате («Про режим» в шапке).
  const seen = Boolean(localStorage.getItem(SEEN_KEY(modeId)));
  const [showPortrait, setShowPortrait] = useState(() => Boolean(card) && !seen);
  if (!mode) return null;

  if (showPortrait && card) {
    return (
      <ModePortrait
        onClose={onClose}
        emoji={mode.emoji}
        name={mode.name}
        groupName={mode.groupName}
        accentColor={mode.groupColor ?? 'var(--accent)'}
        card={card}
        explainer={buildModeIntroExplainer(tr)}
        ctaLabel={seen ? 'Назад к вопросам →' : undefined}
        onStart={() => { localStorage.setItem(SEEN_KEY(modeId), '1'); setShowPortrait(false); }}
      />
    );
  }

  return (
    <IntroSheetShell
      onClose={onClose}
      onComplete={() => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY(modeId));
          const data = raw ? (JSON.parse(raw) as Record<string, string>) : EMPTY;
          api.trackEvent(MODE_CARD_SAVED_EVENT, { modeId, filledFields: Object.values(data).filter((v) => v.trim()).length });
        } catch { /* аналитика не должна ронять сохранение, см. useIntroSheetData.ts */ }
        onComplete?.();
      }}
      storageKey={STORAGE_KEY(modeId)}
      emptyData={EMPTY}
      questions={buildModeIntroQuestions(card)}
      loadExisting={() =>
        api.getModeNotes().then((notes) => {
          const n = notes.find((x) => x.modeId === modeId);
          if (!n) return null;
          const { triggers, feelings, thoughts, behavior, needs } = n;
          return { triggers, feelings, thoughts, behavior, needs, origins: n.origins ?? '', healthyView: n.healthyView ?? '' };
        })
      }
      saveNote={(data) => api.saveModeNote({ modeId, ...data })}
      accentColor={mode.groupColor ?? 'var(--accent)'}
      emoji={mode.emoji}
      title={mode.name}
      subtitle={mode.groupName}
      description={mode.short}
      showDescription={Boolean(mode.short)}
      explainer={buildModeIntroExplainer(tr)}
      headerAction={card && <HeaderInfoButton onClick={() => setShowPortrait(true)} />}
      answerPromptText={tr('Нажми чтобы ответить', 'Нажмите чтобы ответить')}
      nextButtonLabel="Следующий →"
    />
  );
}
