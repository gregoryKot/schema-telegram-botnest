import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphCheck } from './ExScreen';
import { ExBar } from './ExBar';
import { useExBackLabel } from './exBackLabel';
import { LetterDone } from './LetterDone';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { PaperAlert } from '../paper/PaperAlert';
import { SceneLetter } from '../art/SceneLetter';
import { hueStyle } from '../../lib/tone';
import { letterLines, wordsLabel } from './letterWords';
import { EXERCISE_DRAFT_KEYS } from '../../utils/drafts';
import { restoreDraft, useDraftAutosave } from '../../../../shared/src/utils/useDraftAutosave';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { ENTITY_LOOK, PAPER_HUE } from '../../../../shared/src/theme/entityLook';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { LETTER_TEXT_MAX } from '../../../../shared/src/limits/textLimits';

// Имя — из каталога («Письмо себе в детстве»), первое слово над строкой курсивом.
const [TITLE_HEAD, ...TITLE_TAIL] = exerciseCard('letter').title.split(' ');

// Вид (редизайн 2026-11, b18): герой — лист сирени письма со сценой SceneLetter (строки — только
// написанные), разворот на компьютере; «С чего начать» и подсказка — одной наклейкой соломы (на
// телефоне — до письма, а не после «Запечатать»); письмо — белый лист с полями на втором листе
// сирени; сбой — PaperAlert, текст остаётся в поле. Итог — LetterDone в той же рамке экрана.
export function LetterEx({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete?: () => void;
}) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const backLabel = useExBackLabel();
  const [text, setText] = useState(() => restoreDraft<{ text: string }>(EXERCISE_DRAFT_KEYS.letter)?.text ?? '');
  const [done, setDone] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [sealError, setSealError] = useState(false);
  // id запечатанного письма: «Изменить» → «Запечатать» правит его, а не пишет второе.
  const [sealedId, setSealedId] = useState<number | null>(null);
  const [pastLetters, setPastLetters] = useState<Awaited<ReturnType<typeof api.getLetters>>>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const clearDraft = useDraftAutosave(EXERCISE_DRAFT_KEYS.letter, { text });

  useEffect(() => {
    if (!done) textRef.current?.focus();
  }, [done]);

  useEffect(() => {
    if (done)
      api
        .getLetters()
        .then(setPastLetters)
        .catch(() => {});
  }, [done]);

  // Раньше сбой createLetter глушился, а экран всё равно говорил «написано» —
  // 15–25 минут работы терялись без следа. В мини-аппе (LetterToSelf) это уже
  // починено; здесь тот же принцип: подтверждение — только после успеха,
  // при отказе текст остаётся в поле и можно запечатать ещё раз.
  async function seal() {
    if (sealing) return;
    setSealing(true);
    setSealError(false);
    try {
      if (sealedId === null) {
        setSealedId((await api.createLetter(text)).id);
        onComplete?.();
      } else await api.updateLetter(sealedId, text);
      clearDraft();
      setDone(true);
    } catch {
      setSealError(true);
    } finally {
      setSealing(false);
    }
  }

  if (done) {
    return (
      <div className="ex2-screen">
        <ExBar onBack={goBack} label={backLabel} sticky />
        <LetterDone text={text} others={pastLetters.filter((l) => l.id !== sealedId)} onEdit={() => setDone(false)} onClose={goBack}
          lede={tr('Письмо — тоже работа, и порой самая важная. Оно лежит в разделе «Мой путь»: вернись к нему через неделю и перечитай вслух.', 'Письмо — тоже работа, и порой самая важная. Оно лежит в разделе «Мой путь»: вернитесь к нему через неделю и перечитайте вслух.')} />
      </div>
    );
  }

  return (
    <ExScreen
      onBack={goBack} caution spread look="letter"
      heroArt={<SceneLetter lines={letterLines(text)} />}
      eyebrow={exerciseCard('letter').eyebrow}
      title={
        <>
          {TITLE_HEAD}
          <br />
          <span className="it">{TITLE_TAIL.join(' ')}</span>
        </>
      }
      lede={tr(
        'Мысленно сядь рядом со своим внутренним ребёнком — тем, кому тогда было трудно. В схема-терапии эту часть называют Уязвимым Ребёнком. Скажи то, что тогда важно было услышать.',
        'Мысленно сядьте рядом со своим внутренним ребёнком — тем, кому тогда было трудно. В схема-терапии эту часть называют Уязвимым Ребёнком. Скажите то, что тогда важно было услышать.',
      )}
      aside={
        <div className="pp-paper ex2-sticker" style={hueStyle(PAPER_HUE.straw)}>
          <div className="ds-label">С чего начать</div>
          <h3 className="ex2-note-h">Три вопроса перед тем как писать</h3>
          <ul className="ex2-note-list">
            <li>Какой момент из детства – самый трудный?</li>
            <li>Какие были чувства тогда? Чего не хватало?</li>
            <li>Что он должен был услышать – но не услышал?</li>
          </ul>
          <div className="ds-label ex2-sticker-next">Подсказка</div>
          <p className="ex2-note-body">
            {tr('Не редактируй, пиши как идёт. Если становится слишком тяжело — остановись и просто посиди.',
              'Не редактируйте, пишите как идёт. Если становится слишком тяжело — остановитесь и просто посидите.')}
          </p>
        </div>
      }
    >
      <div className="ex2-letter" style={hueStyle(ENTITY_LOOK.letter.hue)}>
        <div className="ex2-letter-hi">Здравствуй,</div>
        <LimitedTextarea
          max={LETTER_TEXT_MAX}
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…"
        />
      </div>
      <div className="ex2-meta">
        <span>Письма хранятся в разделе «Мой путь»</span>
        <span>{wordsLabel(text)}</span>
      </div>
      {detectCrisisAny(text) && <CrisisCard surface="letter" />}
      {sealError && (
        <PaperAlert sign="sheets" className="ex2-alert" title={tr(
          'Не удалось сохранить письмо — текст на месте. Проверь соединение и попробуй ещё раз.',
          'Не удалось сохранить письмо — текст на месте. Проверьте соединение и попробуйте ещё раз.',
        )} />
      )}
      <div className="ex2-foot">
        <span className="ex2-spacer" />
        <button
          className="ds-btn"
          disabled={!text.trim() || sealing}
          onClick={seal}
        >
          Запечатать письмо <GlyphCheck />
        </button>
      </div>
    </ExScreen>
  );
}
