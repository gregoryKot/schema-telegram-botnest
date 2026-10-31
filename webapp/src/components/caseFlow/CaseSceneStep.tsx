import { useEffect, useRef } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { CaseFlowFoot } from './caseFlowUi';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';
import '../../styles/case-quick.css';

/**
 * Шаг 1 из 3 — единственное текстовое поле потока: момент своими словами,
 * без шаблонов сцен (владелец 2026-10-27). Кризисная детекция (правило №7)
 * стоит прямо в файле с полем: трипваер crisis-path.invariants ищет вызов
 * здесь; карточку рисует нижняя панель шага. `crisis` из хука покрывает
 * остальные поля потока, локальный вызов — сам текст на экране.
 */
export function CaseSceneStep({
  value,
  onChange,
  onBack,
  onNext,
  crisis,
  onHardNow,
}: {
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    areaRef.current?.focus();
  }, []);
  return (
    <ExScreen
      onBack={onBack}
      backLabel="Назад"
      eyebrow="Что случилось · 1 из 3"
      title="Что случилось?"
      lede="Крупное необязательно. Хватит мелочи: сообщение, взгляд, тишина в ответ."
    >
      <LimitedTextarea
        max={DIARY_FIELD_MAX}
        ref={areaRef}
        className="ds-textarea"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Например: сообщение прочитано час назад, ответа нет"
        aria-label="Что случилось?"
      />
      <p className="cq-faint">Подробности не нужны — дальше будут вопросы.</p>
      <CaseFlowFoot
        primaryLabel="Дальше"
        primaryDisabled={!value.trim()}
        onPrimary={onNext}
        crisis={crisis || detectCrisisAny(value)}
        onHardNow={onHardNow}
      />
    </ExScreen>
  );
}
