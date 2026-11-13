// Подпись запросов AWS Signature Version 4 — ею подписывается каждый запрос
// к S3-совместимому хранилищу бэкапов (Yandex Object Storage). Своя реализация, а не
// SDK: пробе самопроверки нужен один GET со списком файлов, а тянуть ради
// него @aws-sdk/client-s3 (десятки пакетов) незачем.
//
// Здесь только типизированный вход. Сам алгоритм живёт в deploy/s3-sign.cjs —
// чистом Node без сборки: его же как CLI зовёт scripts/s3-api.sh, так что
// приложение и скрипты бэкапа подписывают одним кодом (правило №3). В
// прод-образе dist/infra/ → ../../deploy/ — это /app/deploy/, каталог
// копируется целиком (Dockerfile).
//
// Сверка: тест-векторы AWS, пример из документации S3 и подпись botocore для
// курсора с `+` — s3-sigv4.spec.ts; поддельный S3 спеков
// (src/test-support/fake-s3.ts) пересчитывает подпись по тому, что реально
// пришло от curl.
export {
  canonicalQuery,
  computeSignature,
  EMPTY_SHA256,
  sha256Hex,
  signRequest,
  toAmzDate,
  uriEncode,
} from '../../deploy/s3-sign.cjs';
export type {
  CanonicalInput,
  SigV4Credentials,
} from '../../deploy/s3-sign.cjs';
