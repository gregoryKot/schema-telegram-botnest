import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Код парного приглашения — используется и для join, и для leave.
 * Формат (`[A-Z0-9]{5,12}`) уже проверяется вручную в join-хендлере,
 * здесь только рантайм-гарантия «это строка» (правило №6 CLAUDE.md).
 */
export class PairCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
