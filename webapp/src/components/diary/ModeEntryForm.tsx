import { useState, useRef, useEffect } from 'react';
import { ExScreen, GlyphArrowLeft } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { MODE_GROUP_HUE, hueStyle } from '../../lib/tone';
import { DiaryAside, DiaryStepCard, DiaryStepQ, DiaryTicks } from './DiaryStepCard';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { DiaryWizardFoot } from './DiaryWizardFoot';
import { ModeDoubtButton } from './ModeDoubtButton';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';
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
  selectedMode: { name: string; short: string; hue: number | undefined; groupName: string } | null;
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
  const hue = selectedMode?.hue;
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
      title={selectedMode?.name ?? ''}
      lede={selectedMode?.short ?? ''}
      aside={
        <>
          <DiaryAside hue={hue} eyebrow="Подсказка" title={tr('Говори от лица режима', 'Говорите от лица режима')}>
            <p className="ds-sub">«Этот режим говорит мне…», «Он чувствует…». Так легче увидеть его как часть, а не отождествлять себя с ним целиком.</p>
          </DiaryAside>
          <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={onChangeMode}>
            <GlyphArrowLeft /> Сменить режим
          </button>
          <ModeDoubtButton modeId={modeId} onSwitch={onSwitchMode} />
        </>
      }
    >
      <p className="ds-sub sd-explainer">{buildModeDiaryExplainer(tr)}</p>

      {/* Прогресс: сегменты по числу шагов + «шаг N из M» */}
      <DiaryTicks filled={tickFilled} active={stepIdx} hue={hue} onJump={setStepIdx} />

      <DiaryStepCard hue={hue} stepIdx={stepIdx} total={totalSteps} required={curRequired} filled={curFilled} filledCount={filledCount}>
        {isHealthyStep ? (
          <>
            <DiaryStepQ id="mode-entry-question" title={tr('Что бы сказал твой Здоровый Взрослый?', 'Что бы сказал ваш Здоровый Взрослый?')}
              hint={tr('Не готовый ответ — а твои слова этому режиму. Пример рядом только как ориентир.', 'Не готовый ответ — а ваши слова этому режиму. Пример рядом только как ориентир.')} />
            {/* Пример-ориентир голоса Здорового Взрослого — зелёная плашка, явно «пример», не ответ. */}
            <div className="ds-card ds-card--row tone-soft sd-example" style={hueStyle(MODE_GROUP_HUE.healthy)}>
              <div className="ds-label tone-ink">Например, можно сказать себе:</div>
              <div className="sd-example-text">«{hint}»</div>
            </div>
            <LimitedTextarea max={DIARY_FIELD_MAX} ref={areaRef} className="ds-textarea"
              rows={4}
              value={healthyResponse}
              onChange={e => setHealthyResponse(e.target.value)}
              placeholder={tr('Напиши своими словами…', 'Напишите своими словами…')}
              aria-labelledby="mode-entry-question"
            />
          </>
        ) : (
          <>
            <DiaryStepQ id="mode-entry-question" title={cur!.title} hint={cur!.hint} />
            <LimitedTextarea max={DIARY_FIELD_MAX} ref={areaRef} className="ds-textarea"
              rows={cur!.rows ?? 3}
              value={curValue}
              onChange={e => set(cur!.key, e.target.value)}
              placeholder={cur!.example}
              aria-labelledby="mode-entry-question"
            />
          </>
        )}
      </DiaryStepCard>

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
        <div role="status" className="sd-save-error">{tr('Не удалось сохранить. Черновик остался — попробуй ещё раз.', 'Не удалось сохранить. Черновик остался — попробуйте ещё раз.')}</div>
      )}
    </ExScreen>
  );
}
