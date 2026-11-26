// Типы для deploy/s3-sign.cjs — единственной реализации подписи AWS SigV4.
// Из TypeScript её берут через src/infra/s3-sigv4.ts; алгоритм здесь не
// повторяется, только сигнатуры.

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface CanonicalInput {
  method: string;
  /** Путь как в запросе (`/bucket/key`). */
  path: string;
  /** Строка запроса с `?` или без; порядок не важен, `+` — только как `%2B`. */
  query: string;
  /** Подписываемые заголовки, имена в нижнем регистре (вместе с host и x-amz-date). */
  headers: Record<string, string>;
  payloadHash: string;
  /** `20150830T123600Z`. */
  amzDate: string;
  region: string;
  service: string;
  secretAccessKey: string;
}

/** SHA-256 пустого тела — у GET/DELETE без тела. */
export declare const EMPTY_SHA256: string;

export declare function sha256Hex(data: string | Buffer): string;

/** RFC 3986: всё, кроме `A-Za-z0-9-_.~`, — `%XX` заглавными (требование SigV4). */
export declare function uriEncode(value: string): string;

/** Параметры отсортированы по имени (затем по значению), каждое закодировано заново. */
export declare function canonicalQuery(query: string): string;

/** Подпись и её составные части — ровно то, что уходит в заголовок Authorization. */
export declare function computeSignature(i: CanonicalInput): {
  signature: string;
  signedHeaders: string;
  scope: string;
};

/** `2015-08-30T12:36:00.000Z` → `20150830T123600Z`. */
export declare function toAmzDate(d: Date): string;

/**
 * Заголовки подписанного запроса (без `host` — его ставит сам клиент).
 * Для S3 добавляется обязательный `x-amz-content-sha256`.
 */
export declare function signRequest(opts: {
  method: string;
  url: URL;
  credentials: SigV4Credentials;
  headers?: Record<string, string>;
  payloadHash?: string;
  service?: string;
  now?: Date;
}): Record<string, string>;
