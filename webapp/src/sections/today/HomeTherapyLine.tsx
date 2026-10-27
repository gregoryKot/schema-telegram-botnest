import { TherapyLine } from '../../components/therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../../components/therapy/useTherapyBridgeTexts';

/** Низ главной: «приложение — самопомощь, не замена терапии» и выход к человеку. */
export function HomeTherapyLine() {
  return <TherapyLine place="home" text={useTherapyBridgeTexts().lineHome} />;
}
