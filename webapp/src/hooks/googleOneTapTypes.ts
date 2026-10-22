// Типы GIS (Google Identity Services) и ответа /api/auth/google/one-tap.
export interface CredentialResponse {
  credential?: string;
}
interface GoogleIdApi {
  initialize(cfg: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    use_fedcm_for_prompt?: boolean;
    auto_select?: boolean;
    /** SHA-256 секрета из куки gsi_nonce — Google вписывает его в id_token. */
    nonce?: string;
  }): void;
  prompt(): void;
  cancel(): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

export interface OneTapResponse {
  accessToken?: string;
  expiresIn?: number;
  twofa?: boolean;
  challengeToken?: string;
}

