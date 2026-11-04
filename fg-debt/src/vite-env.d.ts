/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** "false" shows the Debt Advisor screens again; anything else shows FG Compliance only. */
  readonly VITE_COMPLIANCE_ONLY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
