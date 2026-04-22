import type { PartialSpec } from "./resume-form.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate a partial CreateResumeSpec against required checkout fields. */
export function validateCheckout(spec: PartialSpec): ValidationResult {
  const errors: string[] = [];
  if (!spec.name || spec.name.trim().length < 2) errors.push("name é obrigatório.");
  if (!spec.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(spec.email)) {
    errors.push("email é obrigatório e deve ser válido.");
  }
  const cpf = spec.cpf?.replace(/\D/g, "") ?? "";
  if (cpf.length !== 11) errors.push("cpf é obrigatório (11 dígitos).");
  const phone = spec.phone?.replace(/\D/g, "") ?? "";
  if (phone.length < 10) errors.push("phone é obrigatório (10-11 dígitos).");
  if (
    spec.language &&
    !["pt-BR", "en", "es", "fr", "de", "it"].includes(spec.language)
  ) {
    errors.push("language deve ser: pt-BR, en, es, fr, de ou it.");
  }
  return { valid: errors.length === 0, errors };
}

/** Validate resume content. For create_curriculum, at least one experience is expected. */
export function validateResume(spec: PartialSpec): ValidationResult {
  const errors: string[] = [];
  const exps = spec.experiences;
  if (!exps || exps.length === 0) {
    errors.push("experiences[]: pelo menos uma experiência é necessária.");
  } else {
    exps.forEach((e, i) => {
      if (!e.role) errors.push(`experiences[${i}].role é obrigatório.`);
      if (!e.company) errors.push(`experiences[${i}].company é obrigatório.`);
      if (!e.startDate) errors.push(`experiences[${i}].startDate é obrigatório.`);
      if (!e.description) errors.push(`experiences[${i}].description é obrigatório.`);
    });
  }
  spec.education?.forEach((e, i) => {
    if (!e.institution) errors.push(`education[${i}].institution é obrigatório.`);
    if (!e.course) errors.push(`education[${i}].course é obrigatório.`);
  });
  spec.languages?.forEach((l, i) => {
    if (!l.language) errors.push(`languages[${i}].language é obrigatório.`);
    if (!l.level) errors.push(`languages[${i}].level é obrigatório.`);
  });
  return { valid: errors.length === 0, errors };
}
