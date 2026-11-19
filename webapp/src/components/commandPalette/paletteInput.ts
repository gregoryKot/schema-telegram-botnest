// Вход сборки строк общего поиска (paletteRows.ts и модули строк рядом): режим, данные и действия строк.
import type { Tr } from '../../../../shared/src/needs/types';
import type { CatalogTask } from '../../../../shared/src/tasks/catalog/taskCatalog';
import type { QuickActionId } from '../../../../shared/src/quickActions/quickActions';
import type { ArticleSummary, PracticePlan, TherapyClientSummary, UserId, UserTask } from '../../api';
import type { Reference } from '../../sections/guide/guideReferenceModel';
import type { ReferenceBody } from '../../sections/guide/guideReferenceBody';
import type { GuideSheetTarget } from '../../sections/guide/guideSheetRoute';
import type { PatternTarget } from '../../sections/schemas/patternRoute';
import type { PracticeTarget } from '../../sections/practice/practiceRoute';
import type { Section } from '../appShell/navigation';

/** `tasks` — каталог заданий «Из справочника» (taskCatalog.ts). */
export interface PaletteGuide { ref: Reference; body: ReferenceBody; tasks: CatalogTask[] }

export interface PaletteInput {
  query: string;
  tr: Tr;
  /** Роль THERAPIST: видит клиентов и переключатель режима. */
  therapist: boolean;
  /** Открыт кабинет терапевта: его разделы и листы справочника вместо разделов клиента. */
  therapistMode: boolean;
  /** «Показ экрана»: клиентов нет ни списком, ни по поиску. */
  screenShare: boolean;
  clients: TherapyClientSummary[];
  /** Тексты справочника; грузятся или не загрузились — null, группы «Справочник» нет. */
  guide: PaletteGuide | null;
  /** Свои задания и планы клиента (usePaletteClientData.ts); в кабинете, до загрузки и при сбое — пусто. */
  own: { tasks: UserTask[]; plans: PracticePlan[] };
  /** Статьи сайта (usePaletteClientData.ts); до загрузки и при сбое — пусто, группы «Статьи» нет. */
  articles: ArticleSummary[];
  /** Ключи недавно открытых строк, свежие первыми (paletteRecent.ts). */
  recent: string[];
  /** Второй шаг «Кому дать задание?»: в списке только клиенты; catalogId — выбранное задание справочника. */
  assign: { catalogId: string | null } | null;
  run: {
    section: (id: Section) => void;
    path: (to: string) => void;
    pickAssignee: (catalogId: string | null) => void;
    assign: (clientId: UserId, catalogId: string | null) => void;
    addClient: () => void;
    toggleScreenShare: () => void;
    client: (id: UserId) => void;
    toggleMode: () => void;
    quick: (id: QuickActionId) => void;
    guideSheet: (target: GuideSheetTarget) => void;
    pattern: (target: PatternTarget) => void;
    practice: (target: PracticeTarget) => void;
    ownTask: (taskId: number) => void;
    /** Лист «Настройки», прокрученный к разделу (id из settingsNav.ts); null — с начала. */
    setting: (sectionId: string | null) => void;
    logout: () => void;
  };
}
