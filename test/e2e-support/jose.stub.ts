// 'jose' — чистый ESM-пакет; ts-jest/jest-runtime не умеет требовать его
// напрямую (та же проблема описана в src/auth/providers/google.provider.spec.ts,
// там она решена через jest.mock('jose', ...) внутри одного файла). Для e2e
// AppModule тянет google.provider.ts транзитивно (AuthModule → registry →
// AuthController), поэтому подмена нужна на уровне jest moduleNameMapper
// (test/jest-e2e.json), а не jest.mock — весь смоук ни разу не идёт по пути
// Google OAuth (нет теста на google-провайдер в e2e), поэтому пустых стабов
// достаточно: важно только чтобы модуль вообще резолвился.
export function createRemoteJWKSet(): string {
  return 'FAKE_JWKS_SET';
}

export function jwtVerify(): never {
  throw new Error('jose.jwtVerify stub called — not exercised by e2e smoke');
}
