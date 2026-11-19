import { useEffect, useState } from 'react';
import { isPhoneLayout, LOW_PHONE_MEDIA, PHONE_MEDIA } from '../utils/phoneLayout';

// True в телефонной раскладке (условие — utils/phoneLayout, то же, что в CSS).
// Обновляется при повороте и изменении размера окна.
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(isPhoneLayout);
  useEffect(() => {
    const update = () => setMobile(isPhoneLayout());
    window.addEventListener('resize', update);
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_MEDIA) : null;
    mq?.addEventListener?.('change', update);
    update();
    return () => {
      window.removeEventListener('resize', update);
      mq?.removeEventListener?.('change', update);
    };
  }, []);
  return mobile;
}

const lowPhone = () => typeof window.matchMedia === 'function' && window.matchMedia(LOW_PHONE_MEDIA).matches;

/** True на низком телефоне (utils/phoneLayout, LOW_PHONE_MEDIA); следит за поворотом и размером окна. */
export function useLowPhone(): boolean {
  const [low, setLow] = useState(lowPhone);
  useEffect(() => {
    const update = () => setLow(lowPhone());
    window.addEventListener('resize', update);
    update();
    return () => window.removeEventListener('resize', update);
  }, []);
  return low;
}
