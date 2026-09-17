export type Tab = 'schemas' | 'modes' | 'needs';

export interface SchemasSectionProps {
  onOpenSchema: (opts?: {
    startTest?: boolean;
    tab?: 'needs' | 'schemas' | 'modes';
    highlight?: string;
  }) => void;
  childhoodRatings?: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
  onOpenDiaries?: () => void;
  /** Открыть сразу на этой вкладке — явный переход с карточки «Мой портрет»
   *  вкладки «Я». Не передан (обычный заход через нижнюю навигацию) —
   *  секция берёт последнюю открытую из localStorage, см.
   *  schemas/patternsTabStorage.ts. */
  initialTab?: 'schemas' | 'modes';
}
