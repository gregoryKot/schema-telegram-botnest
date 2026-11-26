import { IsBoolean } from 'class-validator';

// Тумблер «Показать клиенту» во вкладке «Концептуализация»: показать ли
// клиенту схему случая (src/therapy/concept-share.ts). Правило №6 —
// рантайм-валидация тела: строка «true» или пустое тело — 400.
export class ConceptShareDto {
  @IsBoolean()
  shared!: boolean;
}
