/**
 * Порт «куда уходят сообщения Здорового Взрослого».
 *
 * Канал начинался как один Telegram-канал, и отправка жила прямо в сервисе
 * расписания. Площадок будет больше (VK, MAX, ОК) — у каждой свой клиент, свой
 * env и свой язык ошибок. Поэтому «куда отправить» отделено от «что и когда
 * публиковать»: новая площадка = новый адаптер в CHANNEL_TARGETS, расписание,
 * пул фраз и запись поста при этом не меняются.
 */

/** DI-токен: массив адаптеров, по которым идёт рассылка одного текста. */
export const CHANNEL_TARGETS = 'CHANNEL_TARGETS';

/**
 * Публикуемое сообщение. Картинка ленивая и считается один раз на публикацию:
 * текстовым площадкам (Telegram, VK, MAX, Threads) она не нужна, а Pinterest
 * без неё пин не создаст — рендер не должен платиться за всех.
 */
export interface ChannelPost {
  text: string;
  image(): Promise<Buffer>;
}

export interface ChannelTarget {
  /** Ключ для логов и отчётов: 'telegram', 'vk', 'max'. */
  readonly platform: string;
  /** Имя для владельца: «Telegram», «ВКонтакте». */
  readonly title: string;
  /** Env, которым площадка включается — из него собирается подсказка. */
  readonly envKey: string;
  /** Куда постим (@канал, club123) или null — площадка выключена. */
  destination(): string | null;
  /** Отправить пост. Бросает — доставка на этой площадке не удалась. */
  send(post: ChannelPost, destination: string): Promise<void>;
  /** Ошибка отправки → причина словами и подсказка, что чинить. */
  explain(err: unknown): string;
}

/** Площадка, до которой текст доехал. */
export interface Delivery {
  platform: string;
  title: string;
  destination: string;
}

/** Площадка, до которой текст не доехал, и почему. */
export interface DeliveryFailure extends Delivery {
  reason: string;
}

export interface PublishResult {
  /** Все включённые площадки доставили. Зелёная галка для /zv и админки. */
  ok: boolean;
  /**
   * Хотя бы одна площадка доставила — слот закрыт. Повтор дал бы дубль там,
   * где пост уже вышел, поэтому расписание по этому флагу решает: пробовать
   * ещё или оставить слот.
   */
  posted: boolean;
  /** Готовый текст для владельца: /zv, кнопка «Опубликовать» в админке, алерт. */
  message: string;
  delivered: Delivery[];
  failed: DeliveryFailure[];
}
