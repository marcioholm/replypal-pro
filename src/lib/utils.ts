import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  
  // Se tem 11 dígitos (DDD + 9 dígitos), adiciona 55
  if (cleaned.length === 11 && !cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }
  // Se tem 10 dígitos (DDD + 8 dígitos), adiciona 55
  else if (cleaned.length === 10 && !cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }
  
  return cleaned;
}
