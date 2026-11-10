// Тело POST /api/therapy/conceptualization/:clientId/append: холст «Графических
// карт» дописывает в концептуализацию то, что поставил терапевт; только добавление.
// needIds — из NEED_ORDER. Сверка с DTO — src/therapy/dto/concept-append.dto.spec.ts.
/** Линии режима: «схема питает режим» и «✓» — режим заботится о потребности. */
export interface ConceptAppendLink {
  modeId: string;
  schemaIds: string[];
  needIds?: string[];
}
/** Линия «✗» — схема блокирует потребность (ConceptSchemaLink.needIds). */
export type ConceptAppendSchemaLink = { schemaId: string; needIds: string[] };
export interface ConceptAppendBody {
  modeIds?: string[];
  schemaIds?: string[];
  modeLinks?: ConceptAppendLink[];
  schemaLinks?: ConceptAppendSchemaLink[];
}
