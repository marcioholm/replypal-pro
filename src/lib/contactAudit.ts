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
  isLandline?: boolean;
  isDuplicate?: boolean;
  location?: string;
}

const DDD_MAP: Record<string, string> = {
  "11": "São Paulo, SP", "12": "S. J. dos Campos, SP", "13": "Santos, SP", "14": "Bauru, SP", "15": "Sorocaba, SP",
  "16": "Ribeirão Preto, SP", "17": "S. J. do Rio Preto, SP", "18": "Presidente Prudente, SP", "19": "Campinas, SP",
  "21": "Rio de Janeiro, RJ", "22": "Campos dos Goytacazes, RJ", "24": "Petrópolis, RJ", "27": "Vitória, ES", "28": "Cachoeiro de Itapemirim, ES",
  "31": "Belo Horizonte, MG", "32": "Juiz de Fora, MG", "33": "Governador Valadares, MG", "34": "Uberlândia, MG", "35": "Poços de Caldas, MG", "37": "Divinópolis, MG", "38": "Montes Claros, MG",
  "41": "Curitiba, PR", "42": "Ponta Grossa, PR", "43": "Londrina, PR", "44": "Maringá, PR", "45": "Cascavel, PR", "46": "Francisco Beltrão, PR",
  "47": "Joinville, SC", "48": "Florianópolis, SC", "49": "Chapecó, SC",
  "51": "Porto Alegre, RS", "53": "Pelotas, RS", "54": "Caxias do Sul, RS", "55": "Santa Maria, RS",
  "61": "Brasília, DF", "62": "Goiânia, GO", "63": "Palmas, TO", "64": "Rio Verde, GO", "65": "Cuiabá, MT", "66": "Rondonópolis, MT", "67": "Campo Grande, MS", "68": "Rio Branco, AC", "69": "Porto Velho, RO",
  "71": "Salvador, BA", "73": "Itabuna, BA", "74": "Juazeiro, BA", "75": "Feira de Santana, BA", "77": "Vitória da Conquista, BA", "79": "Aracaju, SE",
  "81": "Recife, PE", "82": "Maceió, AL", "83": "João Pessoa, PB", "84": "Natal, RN", "85": "Fortaleza, CE", "86": "Teresina, PI", "87": "Petrolina, PE", "88": "Juazeiro do Norte, CE", "89": "Picos, PI",
  "91": "Belém, PA", "92": "Manaus, AM", "93": "Santarém, PA", "94": "Marabá, PA", "95": "Boa Vista, RR", "96": "Macapá, AP", "97": "Coari, AM", "98": "São Luís, MA", "99": "Imperatriz, MA"
};

const VALID_DDDS = Object.keys(DDD_MAP);

export function analyzeContact(customer: Customer, allCustomers: Customer[] = []): AuditResult {
  const issues: AuditIssue[] = [];
  const rawPhone = customer.whatsapp || customer.phone || "";
  const cleaned = rawPhone.replace(/\D/g, "");
  const normalized = normalizePhone(rawPhone);
  
  let score = 100;
  let severity: Severity = "OK";
  let isLandline = false;
  let location = "";
  let isDuplicate = false;

  // 0. Duplicate Check
  // Só consideramos duplicado se o número for minimamente válido (DDD + Número)
  if (cleaned && cleaned.length >= 10 && allCustomers.length > 0) {
    isDuplicate = allCustomers.some(c => 
      c.id !== customer.id && 
      c.status !== "Encerrado" && // Ignorar contatos já mesclados/encerrados
      (c.whatsapp?.replace(/\D/g, "") === cleaned || c.phone?.replace(/\D/g, "") === cleaned)
    );
    if (isDuplicate) {
      issues.push({ type: "duplicate", message: "Número duplicado na base", severity: "DUPLICATE" });
      score -= 30;
      severity = "DUPLICATE";
    }
  }

  // 1. Basic Validation
  if (!cleaned) {
    issues.push({ type: "empty", message: "Número vazio", severity: "CRITICAL" });
    return { status: "Vazio", severity: "CRITICAL", issues, score: 0, normalizedPhone: "" };
  } else if (/[a-zA-Z]/.test(rawPhone)) {
    issues.push({ type: "letters", message: "Contém letras", severity: "CRITICAL" });
    score -= 50;
    severity = "CRITICAL";
  } else if (cleaned.length < 8) {
    issues.push({ type: "short", message: "Número muito curto", severity: "CRITICAL" });
    score -= 60;
    severity = "CRITICAL";
  }

  // 1.5 Operator Selection Prefix (CSP) or Leading Zero Check
  let hasCspIssue = false;
  let cspSuggestion = "";
  if (cleaned.startsWith("0") && !cleaned.startsWith("0800") && !cleaned.startsWith("0300")) {
    let corrected = "";
    if (cleaned.length === 13 || cleaned.length === 14) {
      const possibleDdd = cleaned.substring(3, 5);
      if (VALID_DDDS.includes(possibleDdd)) {
        corrected = cleaned.substring(3);
      }
    } else if (cleaned.length === 11 || cleaned.length === 12) {
      const possibleDdd = cleaned.substring(1, 3);
      if (VALID_DDDS.includes(possibleDdd)) {
        corrected = cleaned.substring(1);
      }
    }

    if (corrected) {
      // Correção do 9º dígito se necessário
      if (corrected.length === 10) {
        const dddPart = corrected.substring(0, 2);
        const numPart = corrected.substring(2);
        if (["6", "7", "8", "9"].includes(numPart[0])) {
          corrected = dddPart + "9" + numPart;
        }
      }
      // Normalização com prefixo 55
      cspSuggestion = normalizePhone(corrected);
      hasCspIssue = true;
      issues.push({
        type: "csp_prefix",
        message: "Número com zero inicial ou código de operadora",
        severity: "CRITICAL",
        suggestion: cspSuggestion
      });
      score -= 30;
      severity = "CRITICAL";
    }
  }

  // 2. DDD and Location Extraction
  let ddd = "";
  if (cleaned.length >= 10) {
    if (cleaned.startsWith("55") && cleaned.length >= 12) {
      ddd = cleaned.substring(2, 4);
    } else if (cleaned.startsWith("0") && (cleaned.length === 13 || cleaned.length === 14) && !cleaned.startsWith("0800") && !cleaned.startsWith("0300")) {
      ddd = cleaned.substring(3, 5);
    } else if (cleaned.startsWith("0") && (cleaned.length === 11 || cleaned.length === 12) && !cleaned.startsWith("0800") && !cleaned.startsWith("0300")) {
      ddd = cleaned.substring(1, 3);
    } else if (!cleaned.startsWith("55")) {
      if (cleaned.startsWith("0") && cleaned.length > 2) {
        ddd = cleaned.substring(1, 3);
      } else {
        ddd = cleaned.substring(0, 2);
      }
    }

    if (ddd) {
      if (!VALID_DDDS.includes(ddd)) {
        issues.push({ type: "invalid_ddd", message: `DDD inexistente (${ddd})`, severity: "CRITICAL" });
        score -= 40;
        severity = "CRITICAL";
      } else {
        location = DDD_MAP[ddd];
      }
    }
  }

  // 3. Length & Format Business Rules
  // (DDD + 8 digits) OR (55 + DDD + 8 digits)
  // Apenas rodamos as regras de comprimento padrão se não houver um problema de CSP pendente
  if (!hasCspIssue) {
    if (cleaned.length === 10 || (cleaned.startsWith("55") && cleaned.length === 12)) {
      const isDDI = cleaned.startsWith("55");
      const numPart = isDDI ? cleaned.substring(4) : cleaned.substring(2);
      const firstDigit = numPart[0];

      if (["2", "3", "4", "5"].includes(firstDigit)) {
        isLandline = true;
        issues.push({ 
          type: "landline", 
          message: "Telefone corporativo/fixo identificado.", 
          severity: "OK"
        });
      } else if (["6", "7", "8", "9"].includes(firstDigit)) {
        let suggested = isDDI ? "55" + cleaned.substring(2, 4) + "9" + cleaned.substring(4) : cleaned.substring(0, 2) + "9" + cleaned.substring(2);
        issues.push({ 
          type: "missing_ninth", 
          message: "Possível celular antigo sem 9º dígito.", 
          severity: "CRITICAL",
          suggestion: normalizePhone(suggested)
        });
        score -= 20;
        severity = "CRITICAL";
      }
    }

    // (DDD + 9 digits) OR (55 + DDD + 9 digits)
    if (cleaned.length === 11 || (cleaned.startsWith("55") && cleaned.length === 13)) {
      const isDDI = cleaned.startsWith("55");
      const numPart = isDDI ? cleaned.substring(4) : cleaned.substring(2);
      const firstDigit = numPart[0];

      if (firstDigit !== "9") {
        issues.push({ 
          type: "invalid_ninth", 
          message: "Número de 9 dígitos não inicia com 9. Revisar validade.", 
          severity: "ATTENTION"
        });
        score -= 15;
        if (severity !== "CRITICAL") severity = "ATTENTION";
      }
    }
  }

  // Números Longos
  if (cleaned.length > 13) {
    let suggested = cleaned;
    let highlight: [number, number] | undefined = undefined;

    if (cleaned.startsWith("55")) {
      const dddPart = cleaned.substring(2, 4);
      const afterDdd = cleaned.substring(4, 6);
      if (dddPart === afterDdd || (dddPart === "41" && afterDdd === "42")) {
        suggested = "55" + dddPart + cleaned.substring(6);
        highlight = [4, 6];
      }
    }

    issues.push({ 
      type: "long", 
      message: "Número com dígitos excedentes", 
      severity: "ATTENTION",
      // Se tiver erro de operadora (CSP), a sugestão de operadora é prioritária, então não sugerimos o original
      suggestion: hasCspIssue ? undefined : (suggested !== cleaned ? normalizePhone(suggested) : undefined),
      highlightRange: highlight
    });
    score -= 20;
    if (severity !== "CRITICAL") severity = "ATTENTION";
  }

  return {
    status: severity === "OK" ? "Válido" : (isLandline ? "Fixo" : (isDuplicate ? "Duplicado" : "Inconsistente")),
    severity,
    issues,
    suggestion: issues.find(i => i.suggestion)?.suggestion,
    score: Math.max(0, score),
    normalizedPhone: normalized,
    isLandline,
    isDuplicate,
    location
  };
}
