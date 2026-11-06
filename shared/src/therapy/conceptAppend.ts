// Тело POST /api/therapy/conceptualization/:clientId/append — холст «Графических
// карт» дописывает в концептуализацию клиента то, что терапевт поставил на карту.
// Только добавление: сервер объединяет с тем, что уже есть, и ничего не удаляет
// (удаление с холста — про раскладку, убрать из концептуализации можно в полях).
// Контракт сверяется с DTO бэкенда (src/therapy/dto/concept-append.dto.ts) тестом.

/** Связь «схема питает режим», нарисованная линией на холсте. */
export interface ConceptAppendLink {
  modeId: string;
  schemaIds: string[];
}

export interface ConceptAppendBody {
  modeIds?: string[];
  schemaIds?: string[];
  modeLinks?: ConceptAppendLink[];
}
