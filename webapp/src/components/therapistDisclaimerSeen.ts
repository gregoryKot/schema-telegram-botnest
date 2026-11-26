// Единственный писатель флага «дисклеймер терапевта показан». Отдельный
// крошечный модуль: сам компонент грузится лениво, и тянуть его в главный
// чанк ради ключа незачем.

export const THERAPIST_DISCLAIMER_KEY = 'therapist_privacy_disclaimer_seen';

export function markTherapistDisclaimerSeen(): void {
  localStorage.setItem(THERAPIST_DISCLAIMER_KEY, '1');
}

export function isTherapistDisclaimerSeen(): boolean {
  return !!localStorage.getItem(THERAPIST_DISCLAIMER_KEY);
}
