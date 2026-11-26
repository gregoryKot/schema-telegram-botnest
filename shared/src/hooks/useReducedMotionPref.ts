// Состояние тумблера «Меньше движения» (нейроинклюзивность, волна 1).
// Один хук на оба SettingsSheet — правило «одна механика — один компонент».
import { useState } from 'react';
import {
  getMotionPref,
  toggleMotionPref,
  systemPrefersReducedMotion,
} from '../utils/reducedMotion';
import type { MotionPref } from '../utils/reducedMotion';

export function useReducedMotionPref(onChanged?: () => void) {
  const [motionPref, setMotionPref] = useState<MotionPref>(getMotionPref);
  const systemReduced = systemPrefersReducedMotion();
  const reduced = systemReduced || motionPref === 'reduced';
  const sub = systemReduced
    ? 'Включено настройкой системы'
    : 'Без анимаций и конфетти';
  const toggle = () => {
    // Системный prefers-reduced-motion главнее ручного выбора — тумблер
    // в этом случае залочен во включённом положении.
    if (systemReduced) return;
    setMotionPref(toggleMotionPref());
    onChanged?.();
  };
  return { reduced, systemReduced, sub, toggle };
}
