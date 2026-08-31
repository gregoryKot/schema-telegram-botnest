import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import {
  ExScreen,
  StepsBar,
  GlyphArrowLeft,
  GlyphArrowRight,
  GlyphCheck,
} from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { buildSideHints } from './beliefCheck/sideHints';
import { EviList } from './beliefCheck/EviList';
import { BeliefDoneScreen } from './beliefCheck/BeliefDoneScreen';
import { useTr } from '../../utils/addressForm';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';

const STEPS = [
  'Убеждение',
  'Доказательства за',
  'Доказательства против',
  'Переформулировка',
];


export function BeliefCheckEx({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete?: () => void;
}) {
  const tr = useTr();
  const SIDE_HINTS = buildSideHints(tr);
  const goBack = useHistorySheet(onBack);
  const [step, setStep] = useState(0);
  const [belief, setBelief] = useState('');
  const [forList, setForList] = useState<string[]>([]);
  const [againstList, setAgainstList] = useState<string[]>([]);
  const [reframe, setReframe] = useState('');
  const [forInput, setForInput] = useState('');
  const [againstInput, setAgainstInput] = useState('');
  const [done, setDone] = useState(false); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState(false); // createBeliefCheck раньше глотало отказ и всё равно показывало «Готово»
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.getBeliefChecks>>>([]);
  const beliefRef = useRef<HTMLTextAreaElement>(null);
  const reframeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === 0) beliefRef.current?.focus();
    else if (step === 3) reframeRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (done)
      api
        .getBeliefChecks()
        .then((h) => setHistory(h.slice(0, 4)))
        .catch(() => {});
  }, [done]);

  const completed = [
    belief.trim() ? 0 : -1,
    forList.length > 0 ? 1 : -1,
    againstList.length > 0 ? 2 : -1,
    reframe.trim() ? 3 : -1,
  ].filter((x) => x >= 0);

  function addFor() {
    const v = forInput.trim();
    if (!v) return;
    setForList((l) => [...l, v]);
    setForInput('');
  }
  function addAgainst() {
    const v = againstInput.trim();
    if (!v) return;
    setAgainstList((l) => [...l, v]);
    setAgainstInput('');
  }

  async function saveAll() {
    setSaving(true); setSaveError(false);
    try {
      await api.createBeliefCheck({ belief, evidenceFor: forList, evidenceAgainst: againstList, reframe });
      onComplete?.();
      setDone(true);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  const pastChecks = history.filter((h) => h.belief !== belief).slice(0, 3);

  if (done) {
    return (
      <BeliefDoneScreen
        goBack={goBack}
        belief={belief}
        forList={forList}
        againstList={againstList}
        reframe={reframe}
        history={history}
        pastChecks={pastChecks}
        onRestart={() => {
          setDone(false);
          setStep(0);
          setBelief('');
          setForList([]);
          setAgainstList([]);
          setReframe('');
        }}
      />
    );
  }

  const hint = SIDE_HINTS[step];
  return (
    <ExScreen
      onBack={goBack}
      eyebrow="№ 01 · Когнитивная работа"
      eyebrowColor="var(--c-slate)"
      title={
        <>
          Проверка
          <br />
          <span className="it">убеждения</span>
        </>
      }
      lede={tr(
        'Поставь одну мысль перед судом фактов. Что её подтверждает, что опровергает, и как сформулировать точнее.',
        'Поставьте одну мысль перед судом фактов. Что её подтверждает, что опровергает, и как сформулировать точнее.',
      )}
      aside={
        <div className="aside-card">
          <div className="aside-card-eyebrow">Шаг {step + 1} из 4</div>
          <h3>{hint.title}</h3>
          <p className="body">{hint.body}</p>
          <ul>
            {hint.list.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      }
    >
      <StepsBar
        steps={STEPS}
        current={step}
        completed={completed}
        onJump={setStep}
      />

      {step === 0 && (
        <>
          <div className="ex-prompt">
            <div className="ex-prompt-num">1.</div>
            <div>
              <div className="ex-prompt-label">
                {tr(
                  'Запиши мысль, которую хочешь проверить',
                  'Запишите мысль, которую хотите проверить',
                )}
              </div>
              <p className="ex-prompt-hint">
                Одно убеждение за раз. Та самая фраза, которая повторяется в
                голове.
              </p>
              <textarea
                ref={beliefRef}
                className={'paper-input ' + (belief.trim() ? 'is-filled' : '')}
                rows={3}
                value={belief}
                onChange={(e) => setBelief(e.target.value)}
                placeholder="Например: я всегда всё порчу, меня никто не любит…"
              />
            </div>
          </div>
          {detectCrisisAny(belief) && <CrisisCard surface="belief_check" />}
          <div className="ex-foot">
            <span className="spacer" />
            <button
              className="ex-btn ex-btn-primary"
              disabled={!belief.trim()}
              onClick={() => setStep(1)}
            >
              Дальше · доказательства за <GlyphArrowRight />
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="ex-prompt">
            <div className="ex-prompt-num">2.</div>
            <div>
              <div className="ex-prompt-label">
                Что подтверждает «
                <span style={{ color: 'var(--c-rose)' }}>{belief}</span>»?
              </div>
              <p className="ex-prompt-hint">
                Будь честен. Не убеждай себя, что мысль не имеет оснований – она
                их имеет.
              </p>
            </div>
          </div>
          <EviList
            items={forList}
            onRemove={(i) => setForList((l) => l.filter((_, j) => j !== i))}
            input={forInput}
            onInput={setForInput}
            onAdd={addFor}
            placeholder="Добавить доказательство…"
          />
          {detectCrisisAny(forInput, ...forList) && <CrisisCard surface="belief_check" />}
          <div className="ex-foot">
            <button className="ex-btn ex-btn-ghost" onClick={() => setStep(0)}>
              <GlyphArrowLeft /> Назад
            </button>
            <span className="spacer" />
            <button
              className="ex-btn ex-btn-primary"
              disabled={forList.length === 0}
              onClick={() => setStep(2)}
            >
              Дальше · доказательства против <GlyphArrowRight />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="ex-prompt">
            <div className="ex-prompt-num">3.</div>
            <div>
              <div className="ex-prompt-label">
                Что опровергает «
                <span style={{ color: 'var(--c-moss)' }}>{belief}</span>»?
              </div>
              <p className="ex-prompt-hint">
                {tr(
                  'Вспомни факты, исключения, другие точки зрения. Что сказал бы хороший друг?',
                  'Вспомните факты, исключения, другие точки зрения. Что сказал бы хороший друг?',
                )}
              </p>
            </div>
          </div>
          <EviList
            items={againstList}
            onRemove={(i) => setAgainstList((l) => l.filter((_, j) => j !== i))}
            input={againstInput}
            onInput={setAgainstInput}
            onAdd={addAgainst}
            placeholder="Добавить контр-доказательство…"
          />
          {detectCrisisAny(againstInput, ...againstList) && <CrisisCard surface="belief_check" />}
          <div className="ex-foot">
            <button className="ex-btn ex-btn-ghost" onClick={() => setStep(1)}>
              <GlyphArrowLeft /> Назад
            </button>
            <span className="spacer" />
            <button
              className="ex-btn ex-btn-primary"
              disabled={againstList.length === 0}
              onClick={() => setStep(3)}
            >
              Дальше · переформулировка <GlyphArrowRight />
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="ex-prompt">
            <div className="ex-prompt-num">4.</div>
            <div>
              <div className="ex-prompt-label">
                Как можно сформулировать точнее?
              </div>
              <p className="ex-prompt-hint">
                {tr(
                  'Не «всё хорошо». А: что из мысли правда, что преувеличено, и что ты на самом деле сейчас знаешь.',
                  'Не «всё хорошо». А: что из мысли правда, что преувеличено, и что вы на самом деле сейчас знаете.',
                )}
              </p>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
              marginBottom: 28,
              padding: '18px 0',
              borderTop: '1px solid var(--line)',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div>
              <div
                className="eyebrow"
                style={{ color: 'var(--c-rose)', marginBottom: 8 }}
              >
                За · {forList.length}
              </div>
              {forList.slice(0, 3).map((f, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 13,
                    color: 'var(--text-sub)',
                    lineHeight: 1.5,
                    padding: '4px 0',
                  }}
                >
                  · {f}
                </div>
              ))}
            </div>
            <div>
              <div
                className="eyebrow"
                style={{ color: 'var(--c-moss)', marginBottom: 8 }}
              >
                Против · {againstList.length}
              </div>
              {againstList.slice(0, 3).map((a, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 13,
                    color: 'var(--text-sub)',
                    lineHeight: 1.5,
                    padding: '4px 0',
                  }}
                >
                  · {a}
                </div>
              ))}
            </div>
          </div>
          <textarea
            ref={reframeRef}
            className="paper-area"
            value={reframe}
            onChange={(e) => setReframe(e.target.value)}
            placeholder="Иногда я действительно ошибаюсь, но это не значит что я всегда всё порчу…"
            rows={6}
          />
          {detectCrisisAny(reframe) && <CrisisCard surface="belief_check" />}
          {saveError && <div role="alert" style={{ color: 'var(--accent-red)', fontSize: 13, marginBottom: 10 }}>{tr('Не удалось сохранить. Проверь связь и попробуй ещё раз', 'Не удалось сохранить. Проверьте связь и попробуйте ещё раз')}</div>}
          <div className="ex-foot">
            <button className="ex-btn ex-btn-ghost" onClick={() => setStep(2)}>
              <GlyphArrowLeft /> Назад
            </button>
            <span className="spacer" />
            <button
              className="ex-btn ex-btn-primary"
              disabled={!reframe.trim() || saving}
              onClick={saveAll}
            >
              {saving ? 'Сохраняю...' : <>Сохранить и закрыть <GlyphCheck /></>}
            </button>
          </div>
        </>
      )}
    </ExScreen>
  );
}
