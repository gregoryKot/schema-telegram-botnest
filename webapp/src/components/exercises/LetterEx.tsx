import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphCheck } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { fmtAgo } from '../../utils/format';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';

export function LetterEx({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete?: () => void;
}) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [sealError, setSealError] = useState(false);
  const [pastLetters, setPastLetters] = useState<Awaited<ReturnType<typeof api.getLetters>>>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!done) textRef.current?.focus();
  }, [done]);

  useEffect(() => {
    if (done)
      api
        .getLetters()
        .then((l) => setPastLetters(l.slice(0, 3)))
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
      await api.createLetter(text);
      onComplete?.();
      setDone(true);
    } catch {
      setSealError(true);
    } finally {
      setSealing(false);
    }
  }

  if (done) {
    const others = pastLetters.filter((l) => l.text !== text);
    return (
      <ExScreen
        onBack={goBack}
        eyebrow="Письмо · сохранено"
        eyebrowColor="var(--c-moss)"
        title={
          <>
            Письмо
            <br />
            <span className="it">написано.</span>
          </>
        }
        lede="Иногда – самая важная работа. Вернись к нему через неделю и перечитай вслух."
        aside={
          others.length > 0 ? (
            <div className="aside-card">
              <div className="aside-card-eyebrow">
                Прошлые письма · {pastLetters.length}
              </div>
              {others.slice(0, 2).map((l, i) => (
                <div key={i} className="history-row">
                  <span className="history-date">{fmtAgo(l.createdAt)}</span>
                  <span className="history-snippet">
                    «{l.text.slice(0, 120)}…»
                  </span>
                </div>
              ))}
            </div>
          ) : undefined
        }
      >
        <div className="letter-paper">
          <div className="letter-salutation">Здравствуй,</div>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 19,
              lineHeight: '32px',
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {text}
          </div>
          <div className="letter-meta">
            <span>
              {new Date().toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span>{text.split(/\s+/).filter(Boolean).length} слов</span>
          </div>
        </div>
        <div className="ex-foot">
          <button
            className="ex-btn ex-btn-outline"
            onClick={() => setDone(false)}
          >
            Изменить
          </button>
          <span className="spacer" />
          <button className="ex-btn ex-btn-primary" onClick={goBack}>
            Закрыть
          </button>
        </div>
      </ExScreen>
    );
  }

  return (
    <ExScreen
      onBack={goBack}
      eyebrow="№ 04 · Эмоциональная работа"
      eyebrowColor="var(--c-amber)"
      title={
        <>
          Письмо
          <br />
          <span className="it">уязвимому ребёнку</span>
        </>
      }
      lede={tr(
        'Мысленно сядь рядом со своим внутренним ребёнком — тем, кому тогда было трудно. Скажи то, что тогда важно было услышать.',
        'Мысленно сядьте рядом со своим внутренним ребёнком — тем, кому тогда было трудно. Скажите то, что тогда важно было услышать.',
      )}
      aside={
        <>
          <div
            className="aside-card"
            style={{
              borderColor: 'var(--c-amber)40',
              background: 'var(--c-amber)08',
            }}
          >
            <div
              className="aside-card-eyebrow"
              style={{ color: 'var(--c-amber)' }}
            >
              С чего начать
            </div>
            <h3>Три вопроса перед тем как писать</h3>
            <ul style={{ marginTop: 14 }}>
              <li>Какой момент из детства – самый трудный?</li>
              <li>
                {tr(
                  'Какие были чувства тогда? Чего не хватало?',
                  'Какие были чувства тогда? Чего не хватало?',
                )}
              </li>
              <li>Что он должен был услышать – но не услышал?</li>
            </ul>
          </div>
          <div className="aside-card">
            <div className="aside-card-eyebrow">Подсказка</div>
            <p className="body">
              Не редактируй. Пиши от руки сердца, не от головы. Если становится
              слишком – остановись и просто посиди.
            </p>
          </div>
        </>
      }
    >
      <div className="letter-paper">
        <div className="letter-salutation">Здравствуй,</div>
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…"
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11.5,
          color: 'var(--text-faint)',
          marginTop: 12,
          marginBottom: 24,
        }}
      >
        <span>Сохраняется в дневнике</span>
        <span>{text.split(/\s+/).filter(Boolean).length} слов</span>
      </div>
      {detectCrisisAny(text) && <CrisisCard surface="letter" />}
      {sealError && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--c-rose)', marginBottom: 12 }}>
          {tr(
            'Не удалось сохранить письмо — текст на месте. Проверь соединение и попробуй ещё раз.',
            'Не удалось сохранить письмо — текст на месте. Проверьте соединение и попробуйте ещё раз.',
          )}
        </div>
      )}
      <div className="ex-foot">
        <span className="spacer" />
        <button
          className="ex-btn ex-btn-primary"
          disabled={!text.trim() || sealing}
          onClick={seal}
        >
          Запечатать письмо <GlyphCheck />
        </button>
      </div>
    </ExScreen>
  );
}
