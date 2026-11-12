// Упражнение «Критик или забота?»: разобрать фразу внутреннего голоса по
// девяти приметам (shared/src/phraseCheck/criteria), получить вердикт
// (shared/src/phraseCheck/verdict), переписать. Раньше жило только в
// мини-аппе (осознанное решение PR #261 — «в webapp упражнений нет, править
// нечего»); дизайн-аудит 2026-08 (В2) отменил это решение явно. Логика — из
// shared, вёрстка — webapp-стиль (ExScreen), шаги вынесены в phraseCheckEx/*
// (правило №10). Свободный текст проходит кризисный гейт ДО сохранения
// (правило №7). Строки истории кликабельны — открывают PhraseHistoryCard
// с правкой ответа (паритет с miniapp, гейт паритета фич правило №16).
// Вид (редизайн 2026-11, b18): герой — лист сливы со сценой двух голосов (ScenePhrase), со второго шага
// компактнее и без подводки; ход — девять бусин на листе (PhraseBeads); подсказка — общая ExHint (на
// телефоне — свёрнутой строкой после шага); итог — PhraseDoneScreen в общей рамке ExDonePage.
import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import type { PhraseCheckEntry } from '../../api';
import { ExScreen } from './ExScreen';
import { ExPastList } from './ExDonePage';
import { ExHint, ExHintText } from './ExHint';
import { PhraseStartStep } from './phraseCheckEx/PhraseStartStep';
import { PhraseMarkStep } from './phraseCheckEx/PhraseMarkStep';
import { PhraseRewriteStep } from './phraseCheckEx/PhraseRewriteStep';
import { PhraseDoneScreen } from './phraseCheckEx/PhraseDoneScreen';
import { PhraseHistoryCard } from './phraseCheckEx/PhraseHistoryCard';
import { PhraseHistoryRows } from './phraseCheckEx/PhraseHistoryRows';
import { PhraseBeads } from './phraseCheckEx/PhraseBeads';
import { ScenePhrase } from '../art/ScenePhrase';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { PHRASE_CRITERIA } from '../../../../shared/src/phraseCheck/criteria';
import { usePhraseCheckState } from '../../../../shared/src/phraseCheck/usePhraseCheckState';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';

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
    rewrite, setRewrite, inWarmWords, setInWarmWords, answer, reset, clearDraft,
  } = usePhraseCheckState();
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [history, setHistory] = useState<PhraseCheckEntry[]>([]);
  const [openHistoryId, setOpenHistoryId] = useState<number | null>(null);
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
      clearDraft();
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
  const pastEntries = history.filter((h) => h.phrase !== phrase.trim()).slice(0, 3);
  const openHistoryEntry = history.find((h) => h.id === openHistoryId);

  function updateHistoryEntry(id: number, newRewrite: string | null) {
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, rewrite: newRewrite } : h)));
  }
  const removeHistoryEntry = (id: number) => setHistory((prev) => prev.filter((h) => h.id !== id));

  const historyOverlay = openHistoryEntry && (
    <PhraseHistoryCard
      entry={openHistoryEntry}
      onClose={() => setOpenHistoryId(null)}
      onUpdated={updateHistoryEntry}
      onDeleted={removeHistoryEntry}
      tr={tr}
    />
  );
  const pastRows = pastEntries.length > 0 && (
    <ExPastList label={<>Прошлые разборы · {history.length}</>}>
      <PhraseHistoryRows entries={pastEntries} onOpen={setOpenHistoryId} showRewrite />
    </ExPastList>
  );

  if (done) {
    return (
      <>
        <PhraseDoneScreen phrase={phrase.trim()} rewrite={rewrite} marks={marks} past={pastEntries} total={history.length}
          onOpenPast={setOpenHistoryId} onAgain={again} onClose={goBack}
          lede={tr(
            'Голос, который помогает, ставится тренировкой. Даже просто заметить приметы — уже работа.',
            'Голос, который помогает, ставится тренировкой. Даже просто заметить приметы — уже работа.',
          )} />
        {historyOverlay}
      </>
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
    <>
    <ExScreen
      onBack={goBack} caution look="phrase_check" compact={markIndex >= 0} hintBeforeField={onMarks}
      heroArt={<ScenePhrase />}
      heroFoot={<PhraseBeads marks={marks} markIndex={markIndex} step={stepNumber} total={TOTAL_STEPS} />}
      eyebrow={exerciseCard('phrase').eyebrow}
      title={<>Критик<br /><span className="it">или забота?</span></>}
      lede={markIndex < 0 ? tr(
        'Запиши дословно фразу, которую говоришь себе или слышишь от других. Разбери её по девяти приметам и перепиши голосом, который помогает.',
        'Запишите дословно фразу, которую говорите себе или слышите от других. Разберите её по девяти приметам и перепишите голосом, который помогает.',
      ) : undefined}
      aside={
        <>
          <ExHint key={markIndex} title={asideCard.title}><ExHintText>{asideCard.body}</ExHintText></ExHint>
          {markIndex < 0 && pastRows}
        </>
      }
    >
      {markIndex < 0 && (
        <PhraseStartStep phrase={phrase} setPhrase={setPhrase} fieldRef={phraseRef} onNext={() => setMarkIndex(0)} />
      )}

      {onMarks && (
        <PhraseMarkStep
          index={markIndex}
          phrase={phrase.trim()}
          onAnswer={answer}
        />
      )}

      {onRewrite && (
        <PhraseRewriteStep
          phrase={phrase.trim()}
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
    {historyOverlay}
    </>
  );
}
