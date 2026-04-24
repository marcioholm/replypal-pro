export interface CompanyData {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string;
}

const COMPANY_KEY = "replypal_company";

export function getSavedCompany(): CompanyData | null {
  const saved = localStorage.getItem(COMPANY_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
}

export function saveCompany(company: CompanyData) {
  localStorage.setItem(COMPANY_KEY, JSON.stringify(company));
}

export const DEFAULT_COMPANY: CompanyData = {
  name: "SASAKI SOLUÇÕES CONTÁBEIS",
  cnpj: "64.743.930/0001-18",
  email: "",
  phone: "",
  address: "WENCESLAU BRAZ",
  logoUrl: "",
};