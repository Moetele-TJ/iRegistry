// supabase/functions/shared/serial.ts

export function normalizeSerial(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ""); // keep only letters & numbers
}