// Упражнение «Критик или забота?»: разобрать фразу внутреннего голоса по
// девяти приметам (shared/src/phraseCheck/criteria), получить вердикт
// (shared/src/phraseCheck/verdict), переписать. Раньше жило только в
// мини-аппе (осознанное решение PR #261 — «в webapp упражнений нет, править
// нечего»); дизайн-аудит 2026-08 (В2) отменил это решение явно. Логика — из
// shared, вёрстка — webapp-стиль (ExScreen), шаги вынесены в phraseCheckEx/*
// (правило №10). Свободный текст проходит кризисный гейт ДО сохранения
// (правило №7).
import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import type { PhraseCheckEntry } from '../../api';
import { ExScreen, GlyphArrowRight } from './ExScreen';
import { PhraseMarkStep } from './phraseCheckEx/PhraseMarkStep';
import { PhraseRewriteStep } from './phraseCheckEx/PhraseRewriteStep';
import { PhraseDoneCard } from './phraseCheckEx/PhraseDoneCard';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { fmtAgo } from '../../utils/format';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { PHRASE_CRITERIA } from '../../../../shared/src/phraseCheck/criteria';
import { usePhraseCheckState } from '../../../../shared/src/phraseCheck/usePhraseCheckState';

const TOTAL_STEPS = PHRASE_CRITERIA.length + 2; // фраза + 9 примет + переписать

export function PhraseCheckEx({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete?: () => void;
}) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const {
    phrase, setPhrase, markIndex, setMarkIndex, marks,
    rewrite, setRewrite, inWarmWords, setInWarmWords, answer, reset,
  } = usePhraseCheckState();
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [history, setHistory] = useState<PhraseCheckEntry[]>([]);
  const phraseRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (markIndex < 0 && !done) phraseRef.current?.focus();
  }, [markIndex, done]);

  useEffect(() => {
    api.getPhraseChecks().then(setHistory).catch((e) => console.error('getPhraseChecks failed', e));
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await api.createPhraseCheck({
        phrase: phrase.trim(),
        marks,
        rewrite: rewrite.trim() || undefined,
        inWarmWords: inWarmWords && Boolean(rewrite.trim()),
      });
      onComplete?.();
      setDone(true);
      api.getPhraseChecks().then(setHistory).catch((e) => console.error('getPhraseChecks failed', e));
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  function again() {
    setDone(false);
    reset();
  }

  const onMarks = markIndex >= 0 && markIndex < PHRASE_CRITERIA.length;
  const onRewrite = markIndex >= PHRASE_CRITERIA.length;
  const stepNumber = markIndex < 0 ? 1 : Math.min(markIndex + 2, TOTAL_STEPS);
  const progress = (stepNumber / TOTAL_STEPS) * 100;
  const pastEntries = history.filter((h) => h.phrase !== phrase.trim()).slice(0, 3);

  if (done) {
    return (
      <ExScreen
        onBack={goBack}
        eyebrow="Критик или забота? · сохранено"
        eyebrowColor="var(--c-moss)"
        title={<>Разобрано.<br /><span className="it">Голос учится заново.</span></>}
        lede={tr(
          'Голос, который помогает, ставится тренировкой. Даже просто заметить приметы — уже работа.',
          'Голос, который помогает, ставится тренировкой. Даже просто заметить приметы — уже работа.',
        )}
        aside={
          pastEntries.length > 0 ? (
            <div className="aside-card">
              <div className="aside-card-eyebrow">Прошлые разборы · {history.length}</div>
              {pastEntries.map((h) => (
                <div key={h.id} className="history-row">
                  <span className="history-date">{fmtAgo(h.createdAt)}</span>
                  <span className="history-snippet">«{h.phrase}»</span>
                </div>
              ))}
            </div>
          ) : undefined
        }
      >
        <PhraseDoneCard phrase={phrase.trim()} rewrite={rewrite} />
        <div className="ex-foot">
          <button className="ex-btn ex-btn-outline" onClick={again}>Проверить ещё одну</button>
          <span className="spacer" />
          <button className="ex-btn ex-btn-primary" onClick={goBack}>Закрыть</button>
        </div>
      </ExScreen>
    );
  }

  const asideCard = markIndex < 0
    ? {
        title: 'Откуда девять примет',
        body: 'Таблица различий между разрушительной самокритикой и заботой о себе — из схема-терапии: цель фразы, позиция, направленность, отношение к ошибкам и точность формулировки.',
      }
    : onMarks
      ? { title: `Примета ${markIndex + 1} из ${PHRASE_CRITERIA.length}`, body: PHRASE_CRITERIA[markIndex].why }
      : { title: 'Не оценка, а тренировка', body: 'Даже дословная переписанная фраза — тоже работа: она остаётся под рукой как образец на следующий раз.' };

  return (
    <ExScreen
      onBack={goBack}
      eyebrow="№ 08 · Внутренний голос"
      eyebrowColor="var(--c-teal)"
      title={<>Критик<br /><span className="it">или забота?</span></>}
      lede={tr(
        'Запиши фразу, которую сказал себе или услышал — дословно. Разбери её по девяти приметам и перепиши голосом, который помогает.',
        'Запишите фразу, которую сказали себе или услышали — дословно. Разберите её по девяти приметам и перепишите голосом, который помогает.',
      )}
      aside={
        <div className="aside-card">
          <div className="aside-card-eyebrow">{asideCard.title}</div>
          <p className="body">{asideCard.body}</p>
        </div>
      }
    >
      <div
        role="progressbar"
        aria-valuenow={stepNumber}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        style={{ height: 3, borderRadius: 2, background: 'var(--line)', marginBottom: 28, overflow: 'hidden' }}
      >
        <div style={{ width: `${progress}%`, height: '100%', borderRadius: 2, background: 'var(--c-teal)', transition: 'width 0.2s' }} />
      </div>

      {markIndex < 0 && (
        <>
          <div className="ex-prompt">
            <div className="ex-prompt-num">01.</div>
            <div>
              <div className="ex-prompt-label" style={{ fontSize: 30 }}>Что сказал внутренний голос?</div>
              <p className="ex-prompt-hint">
                {tr(
                  'Дословно, теми же словами. Дальше проверим её по девяти приметам.',
                  'Дословно, теми же словами. Дальше проверим её по девяти приметам.',
                )}
              </p>
              <textarea
                ref={phraseRef}
                className="paper-area"
                rows={3}
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="Например: опять всё завалила, ни на что не гожусь"
              />
            </div>
          </div>
          {detectCrisisAny(phrase) && <CrisisCard surface="phrase_check" />}
          <div className="ex-foot">
            <span className="spacer" />
            <button className="ex-btn ex-btn-primary" disabled={!phrase.trim()} onClick={() => setMarkIndex(0)}>
              Проверить <GlyphArrowRight />
            </button>
          </div>
          {pastEntries.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="aside-card-eyebrow" style={{ marginBottom: 10 }}>Прошлые разборы · {history.length}</div>
              {pastEntries.map((h) => (
                <div key={h.id} className="history-row">
                  <span className="history-date">{fmtAgo(h.createdAt)}</span>
                  <span className="history-snippet">«{h.phrase}»{h.rewrite ? ` → «${h.rewrite}»` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {onMarks && (
        <PhraseMarkStep
          index={markIndex}
          total={PHRASE_CRITERIA.length}
          phrase={phrase.trim()}
          onAnswer={answer}
        />
      )}

      {onRewrite && (
        <PhraseRewriteStep
          marks={marks}
          rewrite={rewrite}
          setRewrite={setRewrite}
          inWarmWords={inWarmWords}
          setInWarmWords={setInWarmWords}
          saving={saving}
          saveError={saveError}
          onSave={save}
          tr={tr}
        />
      )}
    </ExScreen>
  );
}

