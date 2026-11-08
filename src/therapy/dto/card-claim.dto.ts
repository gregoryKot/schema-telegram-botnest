import { IsBoolean, IsInt, Max, Min } from 'class-validator';

/**
 * Ответ терапевта на сверку «Это тот же человек?» (S8, therapy-invite-card-
 * claim.ts). `cardId` — та карточка, что была на плашке: если аккаунт за это
 * время ввёл код другой карточки, ответ не применится к ней по ошибке.
 * Int-колонка — граница int32 (S18).
 */
export class ResolveCardClaimDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  cardId!: number;

  @IsBoolean()
  accept!: boolean;
}
