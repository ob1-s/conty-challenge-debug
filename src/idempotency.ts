export function normalizeKey(key: string): string {
  // O retry do incidente contém um espaço de largura zero (U+200B).
  const cleanedKey = key.replace(/\u200B/g, "");
  return cleanedKey.trim().toLowerCase();
}
