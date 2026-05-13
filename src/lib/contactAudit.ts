import { Customer } from "./store";
import { normalizePhone } from "./utils";

export type Severity = "CRITICAL" | "ATTENTION" | "DUPLICATE" | "OK";

export interface AuditIssue {
  type: string;
  message: string;
  severity: Severity;
  suggestion?: string;
  highlightRange?: [number, number]; // [start, end] characters to highlight as suspicious
}

export interface AuditResult {
  status: string;
  severity: Severity;
  issues: AuditIssue[];
  suggestion?: string;
  score: number; // 0 to 100
  normalizedPhone: string;
}

const VALID_DDDS = [
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99"
];

export function analyzeContact(customer: Customer): AuditResult {
  const issues: AuditIssue[] = [];
  const rawPhone = customer.whatsapp || customer.phone || "";
  const cleaned = rawPhone.replace(/\D/g, "");
  const normalized = normalizePhone(rawPhone);
  
  let score = 100;
  let severity: Severity = "OK";

  // 1. Critical Issues
  if (!cleaned) {
    issues.push({ type: "empty", message: "Número vazio", severity: "CRITICAL" });
    score = 0;
    severity = "CRITICAL";
  } else if (/[a-zA-Z]/.test(rawPhone)) {
    issues.push({ type: "letters", message: "Contém letras", severity: "CRITICAL" });
    score -= 50;
    severity = "CRITICAL";
  } else if (cleaned.length < 8) {
    issues.push({ type: "short", message: "Número muito curto", severity: "CRITICAL" });
    score -= 60;
    severity = "CRITICAL";
  }

  // 2. DDD Validation (for Brazil)
  if (cleaned.length >= 10) {
    // Extrair DDD (considerando ou não o 55)
    let ddd = "";
    if (cleaned.startsWith("55") && cleaned.length >= 12) {
      ddd = cleaned.substring(2, 4);
    } else if (!cleaned.startsWith("55")) {
      ddd = cleaned.substring(0, 2);
    }

    if (ddd && !VALID_DDDS.includes(ddd)) {
      issues.push({ type: "invalid_ddd", message: `DDD inexistente (${ddd})`, severity: "CRITICAL" });
      score -= 40;
      severity = "CRITICAL";
    }
  }

  // 3. Attention Issues
  // Sem 9º dígito (Brasil: 55 + DDD + 8 dígitos = 12 total, ou DDD + 8 dígitos = 10 total)
  if (cleaned.length === 10 || (cleaned.startsWith("55") && cleaned.length === 12)) {
    const isFixed = false; // Poderia adicionar lógica para identificar se é fixo (começa com 2, 3, 4, 5)
    
    // Simplificando: se tem 10/12 e não parece fixo, sugerir 9º dígito
    let suggested = "";
    if (cleaned.length === 10) {
      suggested = cleaned.substring(0, 2) + "9" + cleaned.substring(2);
    } else {
      suggested = "55" + cleaned.substring(2, 4) + "9" + cleaned.substring(4);
    }

    issues.push({ 
      type: "missing_ninth", 
      message: "Provável ausência do 9º dígito", 
      severity: "ATTENTION",
      suggestion: suggested
    });
    score -= 10;
    if (severity !== "CRITICAL") severity = "ATTENTION";
  }

  // Números Longos
  if (cleaned.length > 13) {
    // Exemplo: 554142999896358 -> 55 41 [42] 999896358
    // Tentar sugerir remoção de dígitos repetidos
    let suggested = cleaned;
    let highlight: [number, number] | undefined = undefined;

    // Detectar 42 duplicado ou similar após o DDD
    if (cleaned.startsWith("55")) {
      const ddd = cleaned.substring(2, 4);
      const afterDdd = cleaned.substring(4, 6);
      if (ddd === afterDdd || (ddd === "41" && afterDdd === "42")) { // Caso comum 4142
        suggested = "55" + ddd + cleaned.substring(6);
        highlight = [4, 6];
      }
    }

    issues.push({ 
      type: "long", 
      message: "Número com dígitos excedentes", 
      severity: "ATTENTION",
      suggestion: suggested,
      highlightRange: highlight
    });
    score -= 20;
    if (severity !== "CRITICAL") severity = "ATTENTION";
  }

  // 4. Duplicate Check is handled at the group level, but we mark it here if known
  
  return {
    status: severity === "OK" ? "Válido" : "Inconsistente",
    severity,
    issues,
    suggestion: issues.find(i => i.suggestion)?.suggestion,
    score: Math.max(0, score),
    normalizedPhone: normalized
  };
}
