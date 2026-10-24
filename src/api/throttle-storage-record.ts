// `ThrottlerStorageRecord` из @nestjs/throttler не реэкспортируется из
// публичного индекса пакета (только из internal `dist/...interface`) —
// свой тип той же формы, структурно совместимый с интерфейсом
// `ThrottlerStorage.increment` (TS проверяет по форме, не по имени).
export interface ThrottleStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}
