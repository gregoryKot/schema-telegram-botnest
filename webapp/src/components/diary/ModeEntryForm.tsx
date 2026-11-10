import { useState, useRef, useEffect } from 'react';
import { ExScreen, GlyphArrowLeft } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { DiaryAside, DiaryStepCard, DiaryStepQ, DiaryTicks } from './DiaryStepCard';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { PaperAlert } from '../paper/PaperAlert';
import { DiaryWizardFoot } from './DiaryWizardFoot';
import { useModeDoubt } from './useModeDoubt';
import { ModeHealthyExample } from './ModeHealthyExample';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';
import { buildModeDiarySteps } from '../../../../shared/src/mode/modeDiarySteps';
import { buildModeDiaryExplainer } from '../../../../shared/src/mode/modeFlowExplainers';
import { modeLookById } from './modeLookById';
import { glue } from '../../../../shared/src/utils/typo';

// Шаг 2 дневника режимов: визард-разбор режима — один вопрос на экран (низкий порог для СДВГ).
// Обязательна только ситуация; шаги/тексты — shared/mode/modeDiarySteps (правило №3). Состояние —
// в родителе (ModeEntrySheet). Герой — лист бумаги группы режима с его знаком (modeLook), со
// второго шага полосой; «Сменить режим» и «Сравни с похожими» — строкой внизу листа-героя, внутри его
// бумаги; пояснение и подсказка — один раз, на первом шаге, после формы (на ≥1024 — колонкой под
// листом): шапка до первого поля на 390 — не выше ~230px (APP_2026-11.md, раздел b10b).

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
  // Финальный шаг после полей — слова Здорового Взрослого (ModeHealthyExample — пример рядом).
  const HEALTHY_STEP = steps.length;
  const totalSteps = steps.length + 1;

  const [stepIdx, setStepIdx] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Фокус на поле при смене шага — сразу видно, куда писать.
  useEffect(() => { areaRef.current?.focus(); }, [stepIdx]);

  const isHealthyStep = stepIdx === HEALTHY_STEP;
  const cur = isHealthyStep ? null : steps[stepIdx];
  const curValue = isHealthyStep ? healthyResponse : v[cur!.key];
  const curFilled = curValue.trim().length > 0;
  const curRequired = cur?.required ?? false;
  const isFirst = stepIdx === 0;
  // Прогресс заполнения: поля + шаг Здорового Взрослого.
  const tickFilled = [...steps.map(s => v[s.key].trim().length > 0), healthyResponse.trim().length > 0];

  const goPrev = () => (isFirst ? onChangeMode() : setStepIdx(s => Math.max(0, s - 1)));
  const goNext = () => setStepIdx(s => Math.min(totalSteps - 1, s + 1));
  // Ссылка — в листе-герое, лист сравнения — сиблингом после ExScreen, не в липкой колонке разворота.
  const doubt = useModeDoubt(modeId, onSwitchMode);

  return (
    <>
    <ExScreen
      onBack={onBack}
      backLabel="Назад к дневнику"
      look={modeLookById(modeId)} spread compact={!isFirst}
      eyebrow={selectedMode?.groupName ?? 'Режим'}
      title={selectedMode?.name ?? ''}
      lede={isFirst ? glue(selectedMode?.short ?? '') : undefined}
      heroFoot={
        <div className="sd-mode-links">
          <button type="button" className="ds-link sd-mode-link" onClick={onChangeMode}>
            <GlyphArrowLeft /> Сменить режим
          </button>
          {doubt.link}
        </div>
      }
      aside={isFirst && (
        <>
          <p className="sd-explainer">{glue(buildModeDiaryExplainer(tr))}</p>
          <DiaryAside hue={hue} eyebrow="Подсказка" title={tr('Говори от лица режима', 'Говорите от лица режима')}
            text="«Этот режим говорит мне…», «Он чувствует…». Так легче увидеть его как часть, а не отождествлять себя с ним целиком." />
        </>
      )}
    >
      {/* Прогресс: сегменты по числу шагов + «шаг N из M» */}
      <DiaryTicks filled={tickFilled} active={stepIdx} hue={hue} onJump={setStepIdx} />

      <DiaryStepCard hue={hue} stepIdx={stepIdx} total={totalSteps} required={curRequired} filled={curFilled} filledCount={tickFilled.filter(Boolean).length}>
        {isHealthyStep ? (
          <DiaryStepQ id="mode-entry-question" title={tr('Что бы сказал твой Здоровый Взрослый?', 'Что бы сказал ваш Здоровый Взрослый?')}
            hint={tr('Не готовый ответ — а твои слова этому режиму. Пример рядом только как ориентир.', 'Не готовый ответ — а ваши слова этому режиму. Пример рядом только как ориентир.')} />
        ) : (
          <DiaryStepQ id="mode-entry-question" title={cur!.title} hint={cur!.hint} />
        )}
        {isHealthyStep && <ModeHealthyExample modeId={modeId} />}
        <LimitedTextarea max={DIARY_FIELD_MAX} ref={areaRef} className="ds-textarea sd-area"
          rows={4}
          value={curValue}
          onChange={e => (isHealthyStep ? setHealthyResponse(e.target.value) : set(cur!.key, e.target.value))}
          placeholder={isHealthyStep ? tr('Напиши своими словами…', 'Напишите своими словами…') : cur!.example}
          aria-labelledby="mode-entry-question"
        />
      </DiaryStepCard>

      {detectCrisisAny(v.situation, v.thoughts, v.feelings, v.bodyFeelings, v.actions, v.actualNeed, v.childhoodMemories, healthyResponse) && <CrisisCard surface="mode" />}

      <DiaryWizardFoot
        onBack={goPrev}
        backLabel={isFirst ? 'К режимам' : 'Назад'}
        canSave={canSave}
        isLast={stepIdx === totalSteps - 1}
        saving={saving}
        onSave={onSave}
        curFilled={curFilled}
        curRequired={curRequired}
        onNext={goNext}
      />
      {saveError && (
        <PaperAlert role="status" sign="cluster" className="sd-alert" title={tr('Не удалось сохранить. Черновик остался — попробуй ещё раз.', 'Не удалось сохранить. Черновик остался — попробуйте ещё раз.')} />
      )}
    </ExScreen>
    {doubt.sheet}
    </>
  );
}
