import { useState, useRef, useEffect } from 'react';
import { ExScreen, GlyphArrowLeft, GlyphArrowRight, GlyphCheck } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { buildModeDiarySteps } from '../../../../shared/src/mode/modeDiarySteps';

// Шаг 2 дневника режимов: визард-разбор режима — один вопрос на экран
// (правило онбординга «одно главное действие на экран», низкий порог для СДВГ).
// Обязательна только ситуация; остальное можно пропустить или сохранить рано.
// Шаги/тексты/примеры — из общего конфига shared/mode/modeDiarySteps (правило №3).
// Состояние живёт в родителе (ModeEntrySheet): автосейв черновика, сохранение.

export interface ModeFormFields {
  situation: string; thoughts: string; feelings: string; bodyFeelings: string;
  actions: string; actualNeed: string; childhoodMemories: string;
}

type FieldKey = keyof ModeFormFields;

interface Props {
  selectedMode: { name: string; short: string; color: string; groupName: string } | null;
  values: ModeFormFields;
  set: (key: FieldKey, value: string) => void;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onBack: () => void;
  onChangeMode: () => void;
}

export function ModeEntryForm({ selectedMode, values, set, saving, canSave, onSave, onBack, onChangeMode }: Props) {
  const tr = useTr();
  const steps = buildModeDiarySteps(tr);
  const modeColor = selectedMode?.color ?? 'var(--c-slate)';
  const v = values;

  const [stepIdx, setStepIdx] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Фокус на поле при смене шага — сразу видно, куда писать.
  useEffect(() => { areaRef.current?.focus(); }, [stepIdx]);

  const cur = steps[stepIdx];
  const curValue = v[cur.key];
  const curFilled = curValue.trim().length > 0;
  const isLast = stepIdx === steps.length - 1;
  const isFirst = stepIdx === 0;
  const filledCount = steps.filter(s => v[s.key].trim().length > 0).length;

  const goPrev = () => (isFirst ? onChangeMode() : setStepIdx(s => Math.max(0, s - 1)));
  const goNext = () => setStepIdx(s => Math.min(steps.length - 1, s + 1));

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
            <h3>Говори от лица режима</h3>
            <p className="body">«Этот режим говорит мне…», «Он чувствует…». Так легче увидеть его как часть, а не отождествлять себя с ним целиком.</p>
          </div>
          <button className="ex-btn ex-btn-ghost" onClick={onChangeMode} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GlyphArrowLeft /> Сменить режим
          </button>
        </>
      }
    >
      {/* Прогресс: сегменты по числу шагов + «шаг N из M» */}
      <div className="tick-strip">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className={'tick ' + (v[s.key].trim() ? 'is-filled ' : '') + (i === stepIdx ? 'is-active' : '')}
            style={{ '--accent': modeColor } as React.CSSProperties}
            {...pressable(() => setStepIdx(i))}
          />
        ))}
      </div>

      <div className="flash" style={{ borderColor: curFilled ? modeColor + '55' : 'var(--line)' }}>
        <div className="flash-eyebrow" style={{ color: modeColor }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }} />
          Шаг {stepIdx + 1} из {steps.length}
          {cur.required
            ? <span style={{ marginLeft: 6, fontWeight: 600, color: 'var(--c-rose)' }}>· обязательно</span>
            : <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-faint)' }}>· можно пропустить</span>}
          <span className="flash-counter">{filledCount} / {steps.length} заполнено</span>
        </div>
        <div className="flash-q">{cur.title}</div>
        <div className="flash-hint">{cur.hint}</div>
        <textarea
          ref={areaRef}
          className={'paper-area ' + (curFilled ? 'is-filled' : '')}
          rows={cur.rows ?? 3}
          value={curValue}
          onChange={e => set(cur.key, e.target.value)}
          placeholder={cur.example}
        />
      </div>

      {detectCrisisAny(v.situation, v.thoughts, v.feelings, v.bodyFeelings, v.actions, v.actualNeed, v.childhoodMemories) && <CrisisCard surface="mode" />}

      <div className="ex-foot">
        <button className="ex-btn ex-btn-ghost" onClick={goPrev} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GlyphArrowLeft /> {isFirst ? 'К режимам' : 'Назад'}
        </button>
        <span className="spacer" />
        {/* Ранний выход: сохранить, не проходя все шаги (низкий порог) */}
        {canSave && !isLast && (
          <button className="ex-btn ex-btn-ghost" disabled={saving} onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving ? 'Сохраняю…' : 'Сохранить'} {!saving && <GlyphCheck />}
          </button>
        )}
        {isLast ? (
          <button className="ex-btn ex-btn-primary" disabled={!canSave || saving} onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving ? 'Сохраняю…' : 'Сохранить запись'} {!saving && <GlyphCheck />}
          </button>
        ) : (
          <button className="ex-btn ex-btn-primary" disabled={cur.required && !curFilled} onClick={goNext} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {curFilled || cur.required ? 'Дальше' : 'Пропустить'} <GlyphArrowRight />
          </button>
        )}
      </div>
    </ExScreen>
  );
}
