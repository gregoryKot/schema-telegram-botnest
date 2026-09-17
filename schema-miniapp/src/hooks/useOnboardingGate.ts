import { useState, useEffect, useCallback, useRef } from 'react';
import { shouldAskAddressForm } from '../../../shared/src/settings/addressFormPrompt';
import { api } from '../api';
import { setFlag } from '../useUserFlags';
import { logErr } from '../utils/logErr';
import {
  isOnboardingSeenLocally,
  isDisclaimerAcceptedLocally,
  markOnboardingSeenLocally,
  markDisclaimerAcceptedLocally,
  shouldShowOnboarding,
} from '../utils/onboardingState';

/**
 * Показ первого входа: онбординг + согласие. Вся логика собрана здесь —
 * размазанной по App.tsx она разъезжалась, см. utils/onboardingState.ts.
 *
 * `flagsLoaded` — это «флаги РЕАЛЬНО прочитаны с сервера»
 * (useUserFlags().loadedFromServer), а не «попытка завершилась»: неудачный
 * запрос отдаёт дефолты, неотличимые от флагов новичка, и прошедший
 * онбординг человек проходил его снова на каждом заходе.
 */
export function useOnboardingGate(serverDone: boolean, flagsLoaded: boolean) {
  const [consentGiven, setConsentGiven] = useState(isDisclaimerAcceptedLocally);
  const [seenLocally, setSeenLocally] = useState(isOnboardingSeenLocally);
  const [dismissed, setDismissed] = useState(false);
  // Стартовое значение — «вопрос формы обращения точно не всплывёт»: он
  // отложен ранее нажатым «Позже». Иначе ждём ответа сервера, его разберёт
  // App (там же вызовется markAddressFormReady).
  const [addressFormReady, setAddressFormReady] = useState(
    () => !shouldAskAddressForm(null),
  );

  // Серверный флаг — источник правды: у Telegram WebView localStorage
  // ненадёжен, а у ярлыка с домашнего экрана на iOS вообще своё хранилище.
  useEffect(() => {
    if (serverDone) {
      markOnboardingSeenLocally();
      setSeenLocally(true);
    }
  }, [serverDone]);

  // Согласие могли дать на сайте или на другом устройстве.
  useEffect(() => {
    if (isDisclaimerAcceptedLocally()) return;
    api
      .getDisclaimer()
      .then((d) => {
        if (!d.accepted) return;
        markDisclaimerAcceptedLocally();
        setConsentGiven(true);
      })
      .catch(logErr('getDisclaimer'));
  }, []);

  // Латч: раз открывшись, онбординг держится до финальной кнопки. Согласие
  // персистится в середине потока (иначе теряется на шаге «добавить на экран»),
  // и без латча серверный флаг закрыл бы лист под пальцем пользователя.
  const latch = useRef(false);
  if (
    shouldShowOnboarding({
      seenLocally,
      serverDone,
      flagsLoaded,
      addressFormReady,
    })
  ) {
    latch.current = true;
  }

  // Зовётся на каждом шаге онбординга и на финальной кнопке — поэтому
  // серверную запись делаем один раз за сессию, а не на каждый «Далее».
  const flagPersisted = useRef(false);
  const persist = useCallback(() => {
    markOnboardingSeenLocally();
    if (!flagPersisted.current) {
      flagPersisted.current = true;
      setFlag('onboardingV2Done', true).catch(logErr('onboardingV2Done'));
    }
    if (isDisclaimerAcceptedLocally()) return;
    markDisclaimerAcceptedLocally();
    api.acceptDisclaimer().catch(logErr('acceptDisclaimer'));
    setConsentGiven(true);
  }, []);

  const accept = useCallback(() => {
    persist();
    setDismissed(true);
    setSeenLocally(true);
  }, [persist]);

  return {
    visible: latch.current && !dismissed,
    consentGiven,
    persist,
    accept,
    markAddressFormReady: useCallback(() => setAddressFormReady(true), []),
  };
}
