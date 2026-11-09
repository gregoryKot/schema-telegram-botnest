import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphCheck } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { fmtAgo } from '../../utils/format';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { hueStyle, NEED_HUE } from '../../lib/tone';
import { wordsLabel } from './letterWords';
import { EXERCISE_DRAFT_KEYS } from '../../utils/drafts';
import { restoreDraft, useDraftAutosave } from '../../../../shared/src/utils/useDraftAutosave';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { LETTER_TEXT_MAX } from '../../../../shared/src/limits/textLimits';

// Имя — из каталога («Письмо себе в детстве»), первое слово над строкой курсивом.
const [TITLE_HEAD, ...TITLE_TAIL] = exerciseCard('letter').title.split(' ');

export function LetterEx({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete?: () => void;
}) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
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
    const others = pastLetters.filter((l) => l.id !== sealedId);
    return (
      <ExScreen
        onBack={goBack}
        eyebrow="Письмо · сохранено"
          title={
          <>
            Письмо
            <br />
            <span className="it">написано.</span>
          </>
        }
        lede={tr('Письмо — тоже работа, и порой самая важная. Оно лежит в разделе «Мой путь»: вернись к нему через неделю и перечитай вслух.', 'Письмо — тоже работа, и порой самая важная. Оно лежит в разделе «Мой путь»: вернитесь к нему через неделю и перечитайте вслух.')}
        aside={
          others.length > 0 ? (
            <div className="ds-card ex2-note">
              <div className="ds-label">
                Прошлые письма · {others.length}
              </div>
              {others.slice(0, 2).map((l, i) => (
                <div key={i} className="ex2-hist-row">
                  <span className="ex2-hist-date">{fmtAgo(l.createdAt)}</span>
                  <span className="ex2-hist-snip">
                    «{l.text.slice(0, 120)}…»
                  </span>
                </div>
              ))}
            </div>
          ) : undefined
        }
      >
        <div className="ds-card ex2-letter">
          <div className="ex2-letter-hi">Здравствуй,</div>
          <div className="ex2-letter-text">{text}</div>
          <div className="ex2-meta">
            <span>
              {new Date().toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span>{wordsLabel(text)}</span>
          </div>
        </div>
        <div className="ex2-foot">
          <button
            className="ds-btn ds-btn--secondary"
            onClick={() => setDone(false)}
          >
            Изменить
          </button>
          <span className="ex2-spacer" />
          <button className="ds-btn" onClick={goBack}>
            Закрыть
          </button>
        </div>
      </ExScreen>
    );
  }

  return (
    <ExScreen
      onBack={goBack} caution
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
        <>
          <div className="ds-card ex2-note ex2-tint" style={hueStyle(NEED_HUE.limits)}>
            <div className="ds-label">С чего начать</div>
            <h3 className="ex2-note-h">Три вопроса перед тем как писать</h3>
            <ul className="ex2-note-list">
              <li>Какой момент из детства – самый трудный?</li>
              <li>Какие были чувства тогда? Чего не хватало?</li>
              <li>Что он должен был услышать – но не услышал?</li>
            </ul>
          </div>
          <div className="ds-card ex2-note">
            <div className="ds-label">Подсказка</div>
            <p className="ex2-note-body">
              {tr('Не редактируй, пиши как идёт. Если становится слишком тяжело — остановись и просто посиди.',
                'Не редактируйте, пишите как идёт. Если становится слишком тяжело — остановитесь и просто посидите.')}
            </p>
          </div>
        </>
      }
    >
      <div className="ds-card ex2-letter">
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
        <div role="alert" className="ex2-err">
          {tr(
            'Не удалось сохранить письмо — текст на месте. Проверь соединение и попробуй ещё раз.',
            'Не удалось сохранить письмо — текст на месте. Проверьте соединение и попробуйте ещё раз.',
          )}
        </div>
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
