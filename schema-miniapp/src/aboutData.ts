import { useAddressForm } from './utils/addressForm';
import { getAboutText } from '../../shared/src/about/aboutData';

// Контент — в shared (правило №3); здесь только хук формы обращения.
export {
  buildWhyItWorks,
  buildAboutText,
  getAboutText,
  NEEDS_EXPLAINER,
} from '../../shared/src/about/aboutData';

export function useAboutText() {
  return getAboutText(useAddressForm());
}
