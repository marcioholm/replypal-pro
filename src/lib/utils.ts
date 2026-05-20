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
}export function getBrazilianPhoneVariations(phone: string): string[] {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return [];

  // Remove leading 55 if present to work with the local number
  let isBr = false;
  let local = cleaned;
  if (cleaned.startsWith("55") && cleaned.length >= 10) {
    isBr = true;
    local = cleaned.substring(2);
  } else if (cleaned.length >= 10 && cleaned.length <= 11) {
    // If it looks like a Brazilian number without 55 (e.g. 10 or 11 digits)
    isBr = true;
  }

  if (!isBr) {
    // Non-Brazilian or too short: just return standard variations
    return Array.from(new Set([cleaned, "55" + cleaned].filter(Boolean)));
  }

  // It's a Brazilian number. Let's extract DDD and the rest.
  const ddd = local.substring(0, 2);
  const rest = local.substring(2);

  const variations = new Set<string>();

  // Add the cleaned number itself
  variations.add(cleaned);
  variations.add("55" + local);
  variations.add(local);

  // Generate 9th digit variations
  if (rest.length === 9 && rest.startsWith("9")) {
    // It has the 9th digit. Generate the version without it.
    const without9 = ddd + rest.substring(1);
    variations.add(without9);
    variations.add("55" + without9);
  } else if (rest.length === 8) {
    // It does not have the 9th digit. Generate the version with it.
    const with9 = ddd + "9" + rest;
    variations.add(with9);
    variations.add("55" + with9);
  }

  return Array.from(variations);
}
