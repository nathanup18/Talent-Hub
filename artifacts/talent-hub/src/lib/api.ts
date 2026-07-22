// API origin root — always the document origin (no base path prefix).
// The Replit proxy routes /api/* to the API server regardless of the
// frontend artifact's base path, so use root-relative paths.
export const BASE_URL = "/";
