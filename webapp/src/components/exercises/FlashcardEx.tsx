import { useState } from 'react';
import { api } from '../../api';
import { ExScreen } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { DiaryAside } from '../diary/DiaryStepCard';
import { ModeGroupList } from '../diary/ModeGroupList';
import { buildModeIntroExplainer } from '../../../../shared/src/mode/modeFlowExplainers';
import { buildSchemaIntroExplainer } from '../../../../shared/src/schema/schemaFlowExplainers';
import { buildModeIntroQuestions } from '../../../../shared/src/mode/modeIntroQuestions';
import { getModeCard } from '../../../../shared/src/mode/modeCards';
import { MODE_CARD_SAVED_EVENT } from '../../../../shared/src/share/analytics';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SCHEMA_QUESTIONS } from './flashcardQuestions';
import { ModePortrait } from './ModePortrait';
import { PickGroups } from './PickGroups';
import { SavedNoteGate } from './SavedNoteGate';
import { CardQuestions } from './cardFlow/CardQuestions';
import { CardDone } from './cardFlow/CardDone';
import { CardHeroLinks, CardAside } from './cardFlow/CardHeroParts';
import { useCardFlow } from './cardFlow/useCardFlow';
import { findSchema, findMode, SCHEMA_PICK_GROUPS } from './cardFlow/cardEntities';

// Карточки схемы и режима (редизайн 2026-11, APP_2026-11.md, b17): выбор — лист-герой упражнения
// (глина + Layers, небо + Cluster) и список по доменам или группам со знаком у подписи (PickGroups);
// вопросы — лист-герой домена или группы разворотом, со второго вопроса компактнее; «готово» — CardDone.
// Портрет режима показывается один раз на устройство — ключ в localStorage.
const portraitSeenKey = (modeId: string) => `mode_portrait_seen_${modeId}`;

type ExProps = { onBack: () => void; onComplete?: () => void; initialData?: Record<string, string> };

export function SchemaEx({ onBack, initialSchemaId, onComplete, initialData }: ExProps & { initialSchemaId?: string }) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const [picked, setPicked] = useState(() => findSchema(initialSchemaId));
  const card = useCardFlow(initialData);

  if (!picked) {
    return (
      <ExScreen onBack={goBack} caution cautionAt="head" look="schema_card" eyebrow={exerciseCard('schema').eyebrow} title="Карточка схемы"
        lede={tr('Выбери одну из схем. Семь вопросов, чтобы увидеть её во весь рост: триггеры, голос, истоки, реальность, поддержка.', 'Выберите одну из схем. Семь вопросов, чтобы увидеть её во весь рост: триггеры, голос, истоки, реальность, поддержка.')}
        aside={<DiaryAside hue={ENTITY_LOOK.schema_card.hue} eyebrow="Зачем это" title="Назвать – значит вернуть себе власть" text={tr('Схема работает в тени. Когда мы её называем – она становится паттерном, а не «правдой о тебе».', 'Схема работает в тени. Когда мы её называем – она становится паттерном, а не «правдой о вас».')} />}
      >
        <PickGroups clamp groups={SCHEMA_PICK_GROUPS} onPick={id => { card.reset(); setPicked(findSchema(id)); }} />
      </ExScreen>
    );
  }

  if (card.done && card.values) {
    return <CardDone entity="schema_card" subject={picked} questions={SCHEMA_QUESTIONS} data={card.values} onClose={goBack} onEdit={card.edit} />;
  }
  const first = card.step === 0;
  return (
    <ExScreen onBack={goBack} caution={Boolean(initialSchemaId)} look={picked.look} spread compact={!first}
      eyebrow={picked.group} title={picked.name} lede={first ? picked.desc : undefined}
      heroFoot={<CardHeroLinks changeLabel="Сменить схему" onChange={() => setPicked(null)} />}
      aside={<CardAside explainer={first ? buildSchemaIntroExplainer(tr) : undefined} hue={picked.look.hue} eyebrow="Совет" title="Без правильных ответов"
        text={tr('Пиши коротко, своими словами – даже одно предложение полезнее, чем идеальный абзац.', 'Пишите коротко, своими словами – даже одно предложение полезнее, чем идеальный абзац.')} />}
    >
      <SavedNoteGate kind="schema" id={picked.id} preset={card.values}>{initial => (
        <CardQuestions initial={initial} questions={SCHEMA_QUESTIONS} hue={picked.look.hue} step={card.step} onStep={card.setStep} onSaved={card.saved}
          onSave={async data => { await api.saveSchemaNote({ schemaId: picked.id, ...data }); onComplete?.(); }} />
      )}</SavedNoteGate>
    </ExScreen>
  );
}

export function ModeEx({ onBack, initialModeId, onComplete, initialData }: ExProps & { initialModeId?: string }) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const [picked, setPicked] = useState(() => findMode(initialModeId));
  const card = useCardFlow(initialData);
  // Портрет режима — один раз на устройство, дальше сразу вопросы карточки.
  const [showPortrait, setShowPortrait] = useState(() => !initialModeId || !localStorage.getItem(portraitSeenKey(initialModeId)));

  if (!picked) {
    return (
      <ExScreen onBack={goBack} caution cautionAt="head" look="mode_card" eyebrow={exerciseCard('mode').eyebrow} title="Карточка режима"
        lede="Режим – это эмоциональное состояние, которое включается целиком. Описать его – значит научиться его узнавать в моменте."
        aside={<DiaryAside hue={ENTITY_LOOK.mode_card.hue} eyebrow="Совет" title={tr('Начни с того, что чаще включается', 'Начните с того, что чаще включается')} text="Не обязательно работать с трудным режимом. Иногда полезнее описать Здорового Взрослого – чтобы было что искать в себе в трудный момент." />}
      >
        <ModeGroupList modeId="" onPick={id => { card.reset(); setShowPortrait(!localStorage.getItem(portraitSeenKey(id))); setPicked(findMode(id)); }} />
      </ExScreen>
    );
  }

  const modeCard = getModeCard(picked.id);
  const questions = buildModeIntroQuestions(modeCard);
  if (card.done && card.values) {
    return <CardDone entity="mode_card" subject={picked} questions={questions} data={card.values} onClose={goBack} onEdit={card.edit} />;
  }
  const portrait = showPortrait && modeCard;
  // seen — честная подпись кнопки при ручном возврате («Про режим»).
  const seen = Boolean(modeCard) && Boolean(localStorage.getItem(portraitSeenKey(picked.id)));
  const first = card.step === 0;
  return (
    <ExScreen onBack={goBack} caution={Boolean(initialModeId)} look={picked.look} spread compact={!portrait && !first}
      eyebrow={picked.group} title={picked.name} lede={portrait ? portrait.about : first ? picked.desc : undefined}
      heroFoot={<CardHeroLinks changeLabel="Сменить режим" onChange={() => setPicked(null)}
        about={!portrait && modeCard ? { sign: picked.look.sign, onClick: () => setShowPortrait(true) } : undefined} />}
      aside={!portrait && <CardAside explainer={first ? buildModeIntroExplainer(tr) : undefined} hue={picked.look.hue} eyebrow="Подсказка"
        title={tr('Говори в настоящем', 'Говорите в настоящем')} text="«Когда я в этом режиме – я чувствую…» работает лучше, чем абстрактные описания." />}
    >
      {portrait
        ? <ModePortrait card={portrait} hue={picked.look.hue} sign={picked.look.sign} ctaLabel={seen ? 'Назад к вопросам →' : undefined}
            onStart={() => { localStorage.setItem(portraitSeenKey(picked.id), '1'); setShowPortrait(false); }} />
        : <SavedNoteGate kind="mode" id={picked.id} preset={card.values}>{initial => (
            <CardQuestions initial={initial} questions={questions} hue={picked.look.hue} step={card.step} onStep={card.setStep} onSaved={card.saved}
              onSave={async data => {
                await api.saveModeNote({ modeId: picked.id, ...data });
                api.trackEvent(MODE_CARD_SAVED_EVENT, { modeId: picked.id, filledFields: Object.values(data).filter(v => v.trim()).length });
                onComplete?.();
              }} />
          )}</SavedNoteGate>}
    </ExScreen>
  );
}
