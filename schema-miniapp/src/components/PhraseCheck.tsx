// Упражнение «Критик или забота?»: записать реплику внутреннего голоса →
// проверить по девяти приметам (phraseCheck/criteria.ts) → вердикт →
// переписать в самокоррекцию. Шаги — в подкомпонентах (правило №10),
// вердикт — чистая функция (verdict.ts). Свободный текст проходит
// кризисный гейт (правило №7), уезжает зашифрованным на сервер.
// Состояние мастера (фраза/приметы/переписать) — общее с сайтом, живёт в
// shared/src/phraseCheck/usePhraseCheckState (правило №3). done/saveError/
// history/openHistoryId остаются здесь — они специфичны для вёрстки
// мини-аппа. Новую копию этого стейта заводить не надо — расширяй хук.
import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { CrisisGate } from './CrisisGate';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { PHRASE_CRITERIA } from '../../../shared/src/phraseCheck/criteria';
import { usePhraseCheckState } from '../../../shared/src/phraseCheck/usePhraseCheckState';
import { MarksStep } from './phraseCheck/MarksStep';
import { RewriteStep } from './phraseCheck/RewriteStep';
import { PhraseDoneScreen } from './phraseCheck/DoneScreen';
import { PhraseCheckHistoryCard } from './phraseCheck/HistoryCard';
import {
  PhraseCheckHistoryList,
  type PhraseCheckHistoryRow,
} from './phraseCheck/HistoryList';

interface Props {
  onClose: () => void;
  onComplete?: () => void;
}

export function PhraseCheck({ onClose, onComplete }: Props) {
  const tr = useTr();
  const {
    phrase, setPhrase, markIndex, setMarkIndex, marks,
    rewrite, setRewrite, inWarmWords, setInWarmWords, answer,
  } = usePhraseCheckState();
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [history, setHistory] = useState<PhraseCheckHistoryRow[]>([]);
  const [openHistoryId, setOpenHistoryId] = useState<number | null>(null);

  useEffect(() => {
    api
      .getPhraseChecks()
      .then((rows) =>
        setHistory(
          rows.slice(0, 3).map((r) => ({
            id: r.id,
            phrase: r.phrase,
            marks: r.marks,
            rewrite: r.rewrite,
          })),
        ),
      )
      .catch((e) => console.error('getPhraseChecks failed', e));
  }, []);

  const openHistoryEntry = history.find((h) => h.id === openHistoryId);

  function save() {
    const body = {
      phrase: phrase.trim(),
      marks,
      rewrite: rewrite.trim() || undefined,
      inWarmWords: inWarmWords && Boolean(rewrite.trim()),
    };
    api.createPhraseCheck(body).catch((e) => {
      console.error('createPhraseCheck failed', e);
      setSaveError(true);
    });
    setDone(true);
    onComplete?.();
  }

  if (done) {
    return (
      <PhraseDoneScreen
        phrase={phrase.trim()}
        marks={marks}
        rewrite={rewrite}
        onClose={onClose}
        tr={tr}
        saveError={saveError}
      />
    );
  }

  const onMarks = markIndex >= 0 && markIndex < PHRASE_CRITERIA.length;
  // Шагов ровно столько, сколько экранов: фраза + девять примет + переписать.
  // Раньше полоса делилась на три сегмента и после первой же приметы
  // застревала на двух третях — прогресс врал до самого конца.
  const TOTAL_STEPS = PHRASE_CRITERIA.length + 2;
  const stepNumber = markIndex < 0 ? 1 : Math.min(markIndex + 2, TOTAL_STEPS);
  const progress = (stepNumber / TOTAL_STEPS) * 100;

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div
          role="progressbar"
          aria-valuenow={stepNumber}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          style={{
            height: 3,
            borderRadius: 2,
            background: 'rgba(var(--fg-rgb),0.1)',
            marginBottom: 16,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: 2,
              background: 'var(--accent-green)',
              transition: 'width 0.2s',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background:
                'color-mix(in srgb, var(--accent-green) 12%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            🔎
          </div>
          <div>
            <div
              style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}
            >
              Критик или забота?
            </div>
            <div
              style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}
            >
              Разбор фразы по девяти приметам
            </div>
          </div>
        </div>

        {markIndex < 0 && (
          <>
            <div
              style={{
                background: 'rgba(var(--fg-rgb),0.04)',
                border: '1px solid rgba(var(--fg-rgb),0.08)',
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 14,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'var(--text-sub)',
              }}
            >
              {tr(
                'Запиши, что сказал внутренний голос — дословно, теми же словами. Дальше проверим её по девяти приметам разрушительной самокритики: станет видно, критик это или забота о себе, и как сказать то же самое так, чтобы осталось больше сил.',
                'Запишите, что сказал внутренний голос — дословно, теми же словами. Дальше проверим её по девяти приметам разрушительной самокритики: станет видно, критик это или забота о себе, и как сказать то же самое так, чтобы осталось больше сил.',
              )}
            </div>
            <textarea
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="Например: опять всё завалила, ни на что не гожусь"
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(var(--fg-rgb),0.04)',
                border: `1px solid ${phrase.trim() ? 'color-mix(in srgb, var(--accent-green) 30%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`,
                borderRadius: 14,
                padding: '13px 14px',
                color: 'var(--text)',
                fontSize: 14,
                lineHeight: 1.7,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                marginBottom: 14,
              }}
            />
            <CrisisGate texts={[phrase]} surface="phrase_check" />
            <button
              onClick={() => setMarkIndex(0)}
              disabled={!phrase.trim()}
              className="btn-primary"
              style={{ width: '100%', opacity: phrase.trim() ? 1 : 0.45 }}
            >
              Проверить →
            </button>

            <PhraseCheckHistoryList
              history={history}
              onOpen={setOpenHistoryId}
            />
          </>
        )}

        {onMarks && (
          <MarksStep
            index={markIndex}
            total={PHRASE_CRITERIA.length}
            phrase={phrase.trim()}
            onAnswer={answer}
          />
        )}

        {markIndex >= PHRASE_CRITERIA.length && (
          <RewriteStep
            marks={marks}
            rewrite={rewrite}
            setRewrite={setRewrite}
            inWarmWords={inWarmWords}
            setInWarmWords={setInWarmWords}
            onSave={save}
            tr={tr}
          />
        )}

        {markIndex < 0 && (
          <div style={{ marginTop: 12 }}>
            <TherapyNote compact />
          </div>
        )}
      </div>

      {openHistoryEntry && (
        <PhraseCheckHistoryCard
          entry={openHistoryEntry}
          onClose={() => setOpenHistoryId(null)}
          onUpdated={(id, newRewrite) =>
            setHistory((prev) =>
              prev.map((h) =>
                h.id === id ? { ...h, rewrite: newRewrite } : h,
              ),
            )
          }
          tr={tr}
        />
      )}
    </BottomSheet>
  );
}
