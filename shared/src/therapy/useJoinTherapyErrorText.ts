import { useTr } from '../utils/addressForm';
import { joinTherapyErrorText } from './joinErrorText';

// Хук-обёртка для мест без своего `tr` (webapp-хук настроек): форма
// обращения берётся из контекста. null — «не наш случай», оставь дефолт.
export function useJoinTherapyErrorText(): (err: unknown) => string | null {
  const tr = useTr();
  return (err) => joinTherapyErrorText(err, tr);
}
