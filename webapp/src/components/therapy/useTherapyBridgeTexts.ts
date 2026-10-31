import { useTr } from '../../utils/addressForm';
import { buildTherapyBridgeTexts } from '../../../../shared/src/therapy/bridge/therapyBridgeTexts';

/** Тексты «моста к терапевту» в выбранной форме обращения. */
export function useTherapyBridgeTexts() {
  return buildTherapyBridgeTexts(useTr());
}
