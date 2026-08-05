// Упражнение «Критик или забота?»: записать реплику внутреннего голоса →
// проверить её по девяти приметам → увидеть вердикт и переписать в
// самокоррекцию. Приметы — построчно таблица «разрушительная самокритика ↔
// помогающая самокоррекция» (phraseCheck/criteria.ts).
//
// Шаги вынесены в подкомпоненты (правило №10), вердикт — чистая функция
// (verdict.ts, покрыта тестом). Свободный текст проходит кризисный гейт
// (правило №7) и уезжает на сервер зашифрованным (phrase-check.service.ts).
import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { CrisisGate } from './CrisisGate';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import {
  PHRASE_CRITERIA,
  type PhraseMarkId,
} from '../../../shared/src/phraseCheck/criteria';
import { MarksStep } from './phraseCheck/MarksStep';
import { RewriteStep } from './phraseCheck/RewriteStep';
import { PhraseDoneScreen } from './phraseCheck/DoneScreen';

interface Props {
  onClose: () => void;
  onComplete?: () => void;
}

export function PhraseCheck({ onClose, onComplete }: Props) {
  const tr = useTr();
  const [phrase, setPhrase] = useState('');
  const [markIndex, setMarkIndex] = useState(-1); // -1 — ещё на вводе фразы
  const [marks, setMarks] = useState<PhraseMarkId[]>([]);
  const [rewrite, setRewrite] = useState('');
  // Переписанную фразу предлагаем забрать в «Тёплые слова» — по умолчанию да,
  // это ровно тот жанр; галочку видно и её можно снять.
  const [inWarmWords, setInWarmWords] = useState(true);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<
    Array<{ id: number; phrase: string; rewrite: string | null }>
  >([]);

  useEffect(() => {
    api
      .getPhraseChecks()
      .then((rows) =>
        setHistory(
          rows.slice(0, 3).map((r) => ({
            id: r.id,
            phrase: r.phrase,
            rewrite: r.rewrite,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  function answer(id: PhraseMarkId, critic: boolean) {
    if (critic) setMarks((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setMarkIndex((i) => i + 1);
  }

  function save() {
    const body = {
      phrase: phrase.trim(),
      marks,
      rewrite: rewrite.trim() || undefined,
      inWarmWords: inWarmWords && Boolean(rewrite.trim()),
    };
    api.createPhraseCheck(body).catch(() => {});
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

            {history.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>
                  Прошлые разборы
                </div>
                {history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(var(--fg-rgb),0.03)',
                      border: '1px solid rgba(var(--fg-rgb),0.06)',
                      borderRadius: 12,
                      marginBottom: 7,
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: 'var(--text-sub)',
                    }}
                  >
                    «{h.phrase}»
                    {h.rewrite && (
                      <div
                        style={{ color: 'var(--accent-green)', marginTop: 4 }}
                      >
                        → «{h.rewrite}»
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
    </BottomSheet>
  );
}
