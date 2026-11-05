// Тип пропсов ShareCardSheet — для webapp/ShareCardSheet.tsx
// (вёрстка на стороне сайта). Компоненты shared/share/*Button принимают сам
// ShareCardSheet площадки инъекцией (как tr/trackEvent в Celebration.tsx),
// поэтому им нужен только тип его пропсов, не реализация.
import type { ShareCardKind } from './analytics';

export interface ShareCardSheetProps {
  title: string;
  draw: (canvas: HTMLCanvasElement) => void;
  shareText: string;
  fallbackText?: string;
  filename: string;
  eventKind: ShareCardKind;
  onClose: () => void;
  zIndex?: number;
  therapyNote?: boolean;
}
