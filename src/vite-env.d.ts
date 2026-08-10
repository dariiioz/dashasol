/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
interface ImportMetaEnv { readonly VITE_APP_VERSION?: string; readonly VITE_SPOTIFY_CLIENT_ID?: string; readonly VITE_OPENROUTER_API_KEY?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
