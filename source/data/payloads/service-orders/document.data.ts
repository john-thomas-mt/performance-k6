/* CacheFiles uploads the bytes; the server returns a session ref like ["<n>|<filename>"] which we
   correlate (NeoLoad hardcoded a stale FileKey instead). */
export const cacheFilesPayload = (filename: string, base64: string) => [[{ Key: filename, Value: base64 }]];
