/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAIROS_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.svg" {
  const url: string;
  export default url;
}
