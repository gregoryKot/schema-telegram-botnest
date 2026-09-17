import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

/**
 * Тело POST /api/auth/google/one-tap — правило №6 CLAUDE.md: рантайм-валидация
 * декораторами, а не inline-интерфейсом.
 *
 * `credential` — id_token, который Google One Tap отдаёт прямо в браузер (JWT
 * из трёх base64url-сегментов через точку). Форму отсекаем до похода в
 * верификатор; подлинность (подпись/издатель/получатель/срок) проверяет
 * GoogleProvider.verifyIdToken.
 */
export class GoogleOneTapDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  @Matches(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, {
    message: 'credential must be a compact JWT',
  })
  credential!: string;
}
