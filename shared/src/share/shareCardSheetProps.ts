// Тип пропсов ShareCardSheet — общий для webapp/ShareCardSheet.tsx и
// schema-miniapp/ShareCardSheet.tsx (вёрстка у них своя, правило №3, см.
// комментарий в файлах). Компоненты shared/share/*Button принимают сам
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
