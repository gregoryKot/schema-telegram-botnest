import { TherapyLine } from '../../components/therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../../components/therapy/useTherapyBridgeTexts';

/** Низ «Ещё» (до 2026-11-05 — главной): «приложение — самопомощь, не замена терапии» и выход к человеку. */
export function HomeTherapyLine() {
  return <TherapyLine place="home" text={useTherapyBridgeTexts().lineHome} />;
}
