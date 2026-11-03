import { useState, useRef, useEffect } from 'react';
import { api } from '../../api';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { ExScreen, GlyphArrowLeft, GlyphArrowRight, GlyphCheck } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useSavingAction } from '../../hooks/useSavingAction';
import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { hueStyle, DOMAIN_HUE, MODE_GROUP_HUE } from '../../lib/tone';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { buildModeIntroExplainer } from '../../../../shared/src/mode/modeFlowExplainers';
import { buildSchemaIntroExplainer } from '../../../../shared/src/schema/schemaFlowExplainers';
import { buildModeIntroQuestions } from '../../../../shared/src/mode/modeIntroQuestions';
import { getModeCard } from '../../../../shared/src/mode/modeCards';
import { MODE_CARD_SAVED_EVENT } from '../../../../shared/src/share/analytics';
import { SCHEMA_QUESTIONS, type Q } from './flashcardQuestions';
import { ModePortrait } from './ModePortrait';
import { PickRow, PickGroupHead } from './PickRow';
import { SavedNoteGate } from './SavedNoteGate';

// Портрет режима показывается один раз на устройство — ключ в localStorage.
const portraitSeenKey = (modeId: string) => `mode_portrait_seen_${modeId}`;

function FlashcardFlow({ questions, hue, onSave, explainer, initial }: { questions: Q[]; hue: number; onSave: (data: Record<string,string>) => Promise<void>; explainer?: string; initial?: Record<string,string> }) {
  const tr = useTr();
  const [data, setData] = useState<Record<string,string>>(() => ({ ...Object.fromEntries(questions.map(q => [q.key, ''])), ...initial }));
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { areaRef.current?.focus(); }, []);

  const filled = questions.map(q => !!data[q.key].trim());
  const q = questions[step];
  const isLast = step === questions.length - 1;

  // Аудит 2026-08-22 (находка №2): сохранение без состояния отправки, защиты от
  // двойного нажатия и с молчаливым сбоем — человек не понимал, приняли ли нажатие.
  const { saving, error, run } = useSavingAction();
  async function handleSave() {
    const ok = await run(() => onSave(data));
    if (ok) setDone(true);
  }

  if (done) {
    return (
      <div className="ds-card ds-card--ink ex2-done animate-slide" style={hueStyle(hue)}>
        <div className="ex2-stamp"><GlyphCheck /> Карточка сохранена · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
        {questions.map((qq, i) => data[qq.key].trim() && (
          <div key={qq.key}>
            <div className={'ex2-dlabel' + (i % 2 === 0 ? ' is-tone' : '')}>{String(i + 1).padStart(2, '0')} · {qq.label}</div>
            <div className="ex2-dtext">{data[qq.key]}</div>
          </div>
        ))}
        <button className="ds-btn ds-btn--secondary ex2-gap" onClick={() => { setDone(false); setStep(0); }}>Изменить карточку</button>
      </div>
    );
  }

  return (<>
    {explainer && <p className="ex2-fine">{explainer}</p>}
    <div className="ex2-ticks" style={hueStyle(hue)}>
      {questions.map((_, i) => <div key={i} className={'ex2-tick' + (filled[i] ? ' is-filled' : '') + (i === step ? ' is-active' : '')} {...pressable(() => setStep(i))} aria-label={`Вопрос ${i + 1}`} aria-current={i === step ? 'step' : undefined} />)}
    </div>
    <div className={'ds-card ex2-flash' + (data[q.key].trim() ? ' tone-border' : '')} style={hueStyle(hue)}>
      <div className="ds-label ex2-flash-eyebrow">
        <span className="ds-dot tone-fill" />
        <span className="tone-ink">Вопрос {step + 1} из {questions.length}</span>
        {q.optional && <span>· можно пропустить</span>}
        <span className="ex2-flash-counter">{filled.filter(x => x).length} / {questions.length} заполнено</span>
      </div>
      <div className="ex2-flash-q">{q.label}</div>
      <div className="ex2-flash-hint">{q.hint}</div>
      <textarea ref={areaRef} className="ds-textarea" rows={5} value={data[q.key]} onChange={e => setData(d => ({ ...d, [q.key]: e.target.value }))} placeholder={q.placeholder} />
    </div>
    {detectCrisisAny(...Object.values(data)) && <CrisisCard surface="flashcard" />}
    {isLast && error && (
      <div role="alert" className="ex2-err">
        {tr('Не удалось сохранить. Проверь связь и попробуй ещё раз', 'Не удалось сохранить. Проверьте связь и попробуйте ещё раз')}
      </div>
    )}
    <div className="ex2-foot">
      <button className="ds-btn ex2-ghost" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}><GlyphArrowLeft /> Назад</button>
      <span className="ex2-spacer" />
      {!isLast
        ? <button className="ds-btn" onClick={() => setStep(s => s + 1)}>{data[q.key].trim() ? 'Дальше' : 'Пропустить'} <GlyphArrowRight /></button>
        : <button className="ds-btn" disabled={!filled.some(x => x) || saving} onClick={handleSave}>{saving ? 'Сохраняю…' : <>Сохранить карточку <GlyphCheck /></>}</button>
      }
    </div>
  </>);
}

export function SchemaEx({ onBack, initialSchemaId, onComplete, initialData }: { onBack: () => void; initialSchemaId?: string; onComplete?: () => void; initialData?: Record<string,string> }) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const [picked, setPicked] = useState<{ id: string; name: string; desc: string; hue: number; domain: string } | null>(() => {
    if (!initialSchemaId) return null;
    for (const d of SCHEMA_DOMAINS) {
      const s = d.schemas.find(s => s.id === initialSchemaId);
      if (s) return { id: s.id, name: s.name, desc: s.libraryDesc, hue: DOMAIN_HUE[d.id], domain: d.domain };
    }
    return null;
  });

  if (!picked) {
    return (
      <ExScreen onBack={goBack} eyebrow="№ 02 · Знакомство"
        title={<>Карточка<br/><span className="it">схемы</span></>}
        lede={tr('Выбери одну из схем. Семь вопросов, чтобы увидеть её во весь рост: триггеры, голос, истоки, реальность, поддержка.', 'Выберите одну из схем. Семь вопросов, чтобы увидеть её во весь рост: триггеры, голос, истоки, реальность, поддержка.')}
        aside={<div className="ds-card ex2-note"><div className="ds-label">Зачем это</div><h3 className="ex2-note-h">Назвать – значит вернуть себе власть</h3><p className="ex2-note-body">{tr('Схема работает в тени. Когда мы её называем – она становится паттерном, а не «правдой о тебе».', 'Схема работает в тени. Когда мы её называем – она становится паттерном, а не «правдой о вас».')}</p></div>}
      >
        {SCHEMA_DOMAINS.map(d => (
          <div key={d.id}>
            <PickGroupHead hue={DOMAIN_HUE[d.id]}>{d.domain}</PickGroupHead>
            <div className="ex2-picklist">
              {d.schemas.map(s => (
                <PickRow key={s.id} hue={DOMAIN_HUE[d.id]} name={s.name} desc={s.libraryDesc}
                  onPick={() => setPicked({ id: s.id, name: s.name, desc: s.libraryDesc, hue: DOMAIN_HUE[d.id], domain: d.domain })} />
              ))}
            </div>
          </div>
        ))}
      </ExScreen>
    );
  }

  return (
    <ExScreen onBack={goBack} eyebrow={picked.domain} title={picked.name} lede={picked.desc}
      aside={<>
        <div className="ds-card ex2-note ex2-tint" style={hueStyle(picked.hue)}>
          <div className="ds-label">Совет</div>
          <h3 className="ex2-note-h">Без правильных ответов</h3>
          <p className="ex2-note-body">{tr('Пиши коротко, своими словами – даже одно предложение полезнее, чем идеальный абзац.', 'Пишите коротко, своими словами – даже одно предложение полезнее, чем идеальный абзац.')}</p>
        </div>
        <button className="ds-btn ds-btn--sm ex2-ghost" onClick={() => setPicked(null)}><GlyphArrowLeft /> Сменить схему</button>
      </>}
    >
      <SavedNoteGate kind="schema" id={picked.id} preset={initialData}>{initial => <FlashcardFlow initial={initial} questions={SCHEMA_QUESTIONS} hue={picked.hue} onSave={async data => { await api.saveSchemaNote({ schemaId: picked.id, ...data }); onComplete?.(); }} explainer={buildSchemaIntroExplainer(tr)} />}</SavedNoteGate>
    </ExScreen>
  );
}

export function ModeEx({ onBack, initialModeId, onComplete, initialData }: { onBack: () => void; initialModeId?: string; onComplete?: () => void; initialData?: Record<string,string> }) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const [picked, setPicked] = useState<{ id: string; name: string; short: string; hue: number; group: string } | null>(() => {
    if (!initialModeId) return null;
    for (const g of MODE_GROUPS) {
      const m = g.items.find(m => m.id === initialModeId);
      if (m) return { id: m.id, name: m.name, short: m.short, hue: MODE_GROUP_HUE[g.id], group: g.group };
    }
    return null;
  });
  // Портрет режима — один раз на устройство, дальше сразу вопросы карточки.
  const [showPortrait, setShowPortrait] = useState(() => !initialModeId || !localStorage.getItem(portraitSeenKey(initialModeId)));

  if (!picked) {
    return (
      <ExScreen onBack={goBack} eyebrow="№ 03 · Знакомство"
        title={<>Карточка<br/><span className="it">режима</span></>}
        lede="Режим – это эмоциональное состояние, которое включается целиком. Описать его – значит научиться его узнавать в моменте."
        aside={<div className="ds-card ex2-note"><div className="ds-label">Совет</div><h3 className="ex2-note-h">{tr('Начни с того, что чаще включается', 'Начните с того, что чаще включается')}</h3><p className="ex2-note-body">Не обязательно работать с трудным режимом. Иногда полезнее описать Здорового Взрослого – чтобы было что искать в себе в трудный момент.</p></div>}
      >
        {MODE_GROUPS.map(g => (
          <div key={g.id}>
            <PickGroupHead hue={MODE_GROUP_HUE[g.id]}>{g.group}</PickGroupHead>
            <div className="ex2-picklist">
              {g.items.map(m => (
                <PickRow key={m.id} hue={MODE_GROUP_HUE[g.id]} name={m.name} desc={m.short}
                  onPick={() => { setShowPortrait(!localStorage.getItem(portraitSeenKey(m.id))); setPicked({ id: m.id, name: m.name, short: m.short, hue: MODE_GROUP_HUE[g.id], group: g.group }); }} />
              ))}
            </div>
          </div>
        ))}
      </ExScreen>
    );
  }

  const card = getModeCard(picked.id);
  // seen — честная подпись кнопки при ручном возврате («Про режим»).
  const seen = Boolean(card) && Boolean(localStorage.getItem(portraitSeenKey(picked.id)));
  return (
    <ExScreen onBack={goBack} eyebrow={picked.group} title={picked.name} lede={showPortrait && card ? card.about : picked.short}
      aside={<>
        {!showPortrait && card && <button className="ds-btn ds-btn--sm ex2-ghost" onClick={() => setShowPortrait(true)}>ⓘ Про режим</button>}
        {!showPortrait && <div className="ds-card ex2-note ex2-tint" style={hueStyle(picked.hue)}><div className="ds-label">Подсказка</div><h3 className="ex2-note-h">{tr('Говори в настоящем', 'Говорите в настоящем')}</h3><p className="ex2-note-body">«Когда я в этом режиме – я чувствую…» работает лучше, чем абстрактные описания.</p></div>}
        <button className="ds-btn ds-btn--sm ex2-ghost" onClick={() => setPicked(null)}><GlyphArrowLeft /> Сменить режим</button>
      </>}
    >
      {showPortrait && card ? <ModePortrait card={card} hue={picked.hue} ctaLabel={seen ? 'Назад к вопросам →' : undefined} onStart={() => { localStorage.setItem(portraitSeenKey(picked.id), '1'); setShowPortrait(false); }} /> : <SavedNoteGate kind="mode" id={picked.id} preset={initialData}>{initial => <FlashcardFlow initial={initial} questions={buildModeIntroQuestions(card)} hue={picked.hue} onSave={async data => { await api.saveModeNote({ modeId: picked.id, ...data }); api.trackEvent(MODE_CARD_SAVED_EVENT, { modeId: picked.id, filledFields: Object.values(data).filter(v => v.trim()).length }); onComplete?.(); }} explainer={buildModeIntroExplainer(tr)} />}</SavedNoteGate>}
    </ExScreen>
  );
}
