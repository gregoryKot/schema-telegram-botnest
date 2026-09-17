import { useState, useRef, useEffect } from 'react';
import { ExScreen, GlyphArrowLeft } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { DiaryWizardFoot } from './DiaryWizardFoot';
import { ModeDoubtButton } from './ModeDoubtButton';
import { buildModeDiarySteps } from '../../../../shared/src/mode/modeDiarySteps';
import { healthyAdultHint } from '../../../../shared/src/mode/healthyAdultHints';
import { buildModeDiaryExplainer } from '../../../../shared/src/mode/modeFlowExplainers';

// Шаг 2 дневника режимов: визард-разбор режима — один вопрос на экран
// (правило онбординга «одно действие на экран», низкий порог для СДВГ).
// Обязательна только ситуация; шаги/тексты — из shared/mode/modeDiarySteps
// (правило №3). Состояние живёт в родителе (ModeEntrySheet): автосейв, сохранение.

export interface ModeFormFields {
  situation: string; thoughts: string; feelings: string; bodyFeelings: string;
  actions: string; actualNeed: string; childhoodMemories: string;
}

type FieldKey = keyof ModeFormFields;

interface Props {
  selectedMode: { name: string; short: string; color: string; groupName: string } | null;
  modeId: string;
  values: ModeFormFields;
  set: (key: FieldKey, value: string) => void;
  healthyResponse: string;
  setHealthyResponse: (value: string) => void;
  saving: boolean; saveError?: boolean; canSave: boolean;
  onSave: () => void;
  onBack: () => void;
  onChangeMode: () => void;
  onSwitchMode: (id: string) => void;
}

export function ModeEntryForm({ selectedMode, modeId, values, set, healthyResponse, setHealthyResponse, saving, saveError, canSave, onSave, onBack, onChangeMode, onSwitchMode }: Props) {
  const tr = useTr();
  const steps = buildModeDiarySteps(tr);
  const modeColor = selectedMode?.color ?? 'var(--c-slate)';
  const v = values;

  // Финальный шаг после полей — слова Здорового Взрослого (клиент пишет сам,
  // подсказка-пример рядом лишь как ориентир, правило онбординга).
  const HEALTHY_STEP = steps.length;
  const totalSteps = steps.length + 1;
  const hint = healthyAdultHint(modeId);

  const [stepIdx, setStepIdx] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Фокус на поле при смене шага — сразу видно, куда писать.
  useEffect(() => { areaRef.current?.focus(); }, [stepIdx]);

  const isHealthyStep = stepIdx === HEALTHY_STEP;
  const cur = isHealthyStep ? null : steps[stepIdx];
  const curValue = isHealthyStep ? healthyResponse : v[cur!.key];
  const curFilled = curValue.trim().length > 0;
  const curRequired = cur?.required ?? false;
  const isLast = stepIdx === totalSteps - 1;
  const isFirst = stepIdx === 0;
  // Прогресс заполнения: поля + шаг Здорового Взрослого.
  const tickFilled = [...steps.map(s => v[s.key].trim().length > 0), healthyResponse.trim().length > 0];
  const filledCount = tickFilled.filter(Boolean).length;

  const goPrev = () => (isFirst ? onChangeMode() : setStepIdx(s => Math.max(0, s - 1)));
  const goNext = () => setStepIdx(s => Math.min(totalSteps - 1, s + 1));

  return (
    <ExScreen
      onBack={onBack}
      backLabel="Назад к дневнику"
      eyebrow={selectedMode?.groupName ?? 'Режим'}
      eyebrowColor={modeColor}
      title={selectedMode?.name ?? ''}
      lede={selectedMode?.short ?? ''}
      aside={
        <>
          <div className="aside-card" style={{ borderColor: modeColor + '40', background: modeColor + '08', position: 'sticky', top: 40 }}>
            <div className="aside-card-eyebrow" style={{ color: modeColor }}>Подсказка</div>
            <h3>{tr('Говори от лица режима', 'Говорите от лица режима')}</h3>
            <p className="body">«Этот режим говорит мне…», «Он чувствует…». Так легче увидеть его как часть, а не отождествлять себя с ним целиком.</p>
          </div>
          <button className="ex-btn ex-btn-ghost" onClick={onChangeMode} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
            <GlyphArrowLeft /> Сменить режим
          </button>
          <ModeDoubtButton modeId={modeId} onSwitch={onSwitchMode} />
        </>
      }
    >
      <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.5, marginBottom: 20 }}>{buildModeDiaryExplainer(tr)}</p>

      {/* Прогресс: сегменты по числу шагов + «шаг N из M» */}
      <div className="tick-strip">
        {tickFilled.map((filled, i) => (
          <div
            key={i}
            className={'tick ' + (filled ? 'is-filled ' : '') + (i === stepIdx ? 'is-active' : '')}
            style={{ '--accent': modeColor } as React.CSSProperties}
            {...pressable(() => setStepIdx(i))}
          />
        ))}
      </div>

      <div className="flash" style={{ borderColor: curFilled ? modeColor + '55' : 'var(--line)' }}>
        <div className="flash-eyebrow" style={{ color: modeColor }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }} />
          Шаг {stepIdx + 1} из {totalSteps}
          {curRequired ? <span style={{ marginLeft: 6, fontWeight: 600, color: 'var(--c-rose)' }}>· обязательно</span> : <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-faint)' }}>· можно пропустить</span>}
          <span className="flash-counter">{filledCount} / {totalSteps} заполнено</span>
        </div>
        {isHealthyStep ? (
          <>
            <div id="mode-entry-question" className="flash-q">{tr('Что бы сказал твой Здоровый Взрослый?', 'Что бы сказал ваш Здоровый Взрослый?')}</div>
            <div className="flash-hint">{tr('Не готовый ответ — а твои слова этому режиму. Пример рядом только как ориентир.', 'Не готовый ответ — а ваши слова этому режиму. Пример рядом только как ориентир.')}</div>
            {/* Пример-ориентир голоса Здорового Взрослого — зелёная плашка, явно «пример», не ответ. */}
            <div style={{ margin: '4px 0 12px', padding: '12px 14px', borderRadius: 'var(--r-12)', background: 'var(--c-moss)10', border: '1px solid var(--c-moss)33' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--c-moss)', marginBottom: 6 }}>Например, можно сказать себе:</div>
              <div style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--text-sub)', lineHeight: 1.55 }}>«{hint}»</div>
            </div>
            <textarea
              ref={areaRef}
              className={'paper-area ' + (curFilled ? 'is-filled' : '')}
              rows={4}
              value={healthyResponse}
              onChange={e => setHealthyResponse(e.target.value)}
              placeholder={tr('Напиши своими словами…', 'Напишите своими словами…')}
              aria-labelledby="mode-entry-question"
            />
          </>
        ) : (
          <>
            <div id="mode-entry-question" className="flash-q">{cur!.title}</div>
            <div className="flash-hint">{cur!.hint}</div>
            <textarea
              ref={areaRef}
              className={'paper-area ' + (curFilled ? 'is-filled' : '')}
              rows={cur!.rows ?? 3}
              value={curValue}
              onChange={e => set(cur!.key, e.target.value)}
              placeholder={cur!.example}
              aria-labelledby="mode-entry-question"
            />
          </>
        )}
      </div>

      {detectCrisisAny(v.situation, v.thoughts, v.feelings, v.bodyFeelings, v.actions, v.actualNeed, v.childhoodMemories, healthyResponse) && <CrisisCard surface="mode" />}

      <DiaryWizardFoot
        onBack={goPrev}
        backLabel={isFirst ? 'К режимам' : 'Назад'}
        canSave={canSave}
        isLast={isLast}
        saving={saving}
        onSave={onSave}
        curFilled={curFilled}
        curRequired={curRequired}
        onNext={goNext}
      />
      {saveError && (
        <div role="status" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: 'var(--accent-red)' }}>{tr('Не удалось сохранить. Черновик остался — попробуй ещё раз.', 'Не удалось сохранить. Черновик остался — попробуйте ещё раз.')}</div>
      )}
    </ExScreen>
  );
}
