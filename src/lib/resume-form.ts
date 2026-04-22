import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { input, select, confirm, editor } from "@inquirer/prompts";
import { FileError } from "./errors.js";

export interface ExperienceEntry {
  role: string;
  company: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description: string;
  location?: string;
}

export interface EducationEntry {
  institution: string;
  course: string;
  startYear: string;
  endYear?: string;
  ongoing?: boolean;
  description?: string;
}

export interface LanguageEntry {
  language: string;
  level: string;
}

export interface CertificationEntry {
  name: string;
  institution?: string;
  year?: string;
  url?: string;
}

export interface ProjectEntry {
  name: string;
  description: string;
  link?: string;
  technologies?: string[];
}

export interface CreateResumeSpec {
  /** Checkout data (also sent to POST /orders) */
  name: string;
  email: string;
  cpf: string;
  phone: string;
  language?: string;
  couponCode?: string;
  /** Resume content (sent to POST /orders/:id/fill-resume) */
  jobDescription?: string;
  linkedinUrl?: string;
  summary?: string;
  experiences?: ExperienceEntry[];
  education?: EducationEntry[];
  skills?: string[];
  languages?: LanguageEntry[];
  certifications?: CertificationEntry[];
  projects?: ProjectEntry[];
}

export type PartialSpec = Partial<CreateResumeSpec>;

export function parseResumeSpecFile(filePath: string): PartialSpec {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new FileError(`Arquivo não encontrado: ${abs}`, "file_not_found");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf-8"));
  } catch {
    throw new FileError(`JSON inválido em ${abs}`, "invalid_spec");
  }
  if (!raw || typeof raw !== "object") {
    throw new FileError(`JSON deve ser um objeto em ${abs}`, "invalid_spec");
  }
  return raw as PartialSpec;
}

/** Sections that go to fill-resume (excludes checkout fields). */
export function extractFillBody(spec: CreateResumeSpec): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (spec.jobDescription) body.jobDescription = spec.jobDescription;
  if (spec.linkedinUrl) body.linkedinUrl = spec.linkedinUrl;
  if (spec.summary) body.summary = spec.summary;
  if (spec.experiences?.length) body.experiences = spec.experiences;
  if (spec.education?.length) body.education = spec.education;
  if (spec.skills?.length) body.skills = spec.skills;
  if (spec.languages?.length) body.languages = spec.languages;
  if (spec.certifications?.length) body.certifications = spec.certifications;
  if (spec.projects?.length) body.projects = spec.projects;
  return body;
}

// ── Visual framing (matches prompts.ts) ─────────────────────────────

function section(title: string) {
  process.stderr.write(`\n  ${chalk.bold.cyan("── " + title + " " + "─".repeat(Math.max(0, 50 - title.length)))}\n\n`);
}

// ── Interactive collector ───────────────────────────────────────────

async function collectExperiences(initial?: ExperienceEntry[]): Promise<ExperienceEntry[]> {
  const results: ExperienceEntry[] = initial ?? [];
  const addMore = async (): Promise<boolean> => {
    if (results.length === 0) return true;
    return confirm({ message: "Adicionar outra experiência?", default: false });
  };

  while (await addMore()) {
    const role = await input({ message: "Cargo", required: true });
    const company = await input({ message: "Empresa", required: true });
    const startDate = await input({
      message: "Início (MM/AAAA)",
      required: true,
      validate: (v) => /^\d{2}\/\d{4}$/.test(v) || "Use MM/AAAA.",
    });
    const current = await confirm({ message: "Ainda trabalha aqui?", default: false });
    let endDate: string | undefined;
    if (!current) {
      endDate = await input({
        message: "Fim (MM/AAAA)",
        required: true,
        validate: (v) => /^\d{2}\/\d{4}$/.test(v) || "Use MM/AAAA.",
      });
    }
    const description = await editor({
      message: "Descrição (bullets separados por Enter; salve e feche)",
    });

    results.push({ role, company, startDate, endDate, current, description: description.trim() });
  }
  return results;
}

async function collectEducation(initial?: EducationEntry[]): Promise<EducationEntry[]> {
  const results: EducationEntry[] = initial ?? [];
  const addMore = async (): Promise<boolean> => {
    if (results.length === 0) return true;
    return confirm({ message: "Adicionar outra formação?", default: false });
  };

  while (await addMore()) {
    const institution = await input({ message: "Instituição", required: true });
    const course = await input({ message: "Curso", required: true });
    const startYear = await input({
      message: "Ano de início",
      required: true,
      validate: (v) => /^\d{4}$/.test(v) || "Use AAAA.",
    });
    const ongoing = await confirm({ message: "Em andamento?", default: false });
    let endYear: string | undefined;
    if (!ongoing) {
      endYear = await input({
        message: "Ano de conclusão",
        required: true,
        validate: (v) => /^\d{4}$/.test(v) || "Use AAAA.",
      });
    }
    results.push({ institution, course, startYear, endYear, ongoing });
  }
  return results;
}

async function collectLanguages(initial?: LanguageEntry[]): Promise<LanguageEntry[]> {
  const results: LanguageEntry[] = initial ?? [];
  const levels = [
    { value: "Básico", name: "Básico" },
    { value: "Intermediário", name: "Intermediário" },
    { value: "Avançado", name: "Avançado" },
    { value: "Fluente", name: "Fluente" },
    { value: "Nativo", name: "Nativo" },
  ];
  const addMore = async (): Promise<boolean> => {
    if (results.length === 0) return true;
    return confirm({ message: "Adicionar outro idioma?", default: false });
  };

  while (await addMore()) {
    const language = await input({ message: "Idioma", required: true });
    const level = await select({ message: "Nível", choices: levels });
    results.push({ language, level });
  }
  return results;
}

async function collectCertifications(
  initial?: CertificationEntry[],
): Promise<CertificationEntry[]> {
  if (initial && initial.length > 0) return initial;
  const wants = await confirm({ message: "Adicionar certificações?", default: false });
  if (!wants) return [];
  const results: CertificationEntry[] = [];
  while (true) {
    const name = await input({ message: "Nome da certificação", required: true });
    const institution = await input({ message: "Instituição (Enter p/ pular)" });
    const year = await input({ message: "Ano (AAAA, Enter p/ pular)" });
    results.push({ name, institution: institution || undefined, year: year || undefined });
    if (!(await confirm({ message: "Adicionar outra?", default: false }))) break;
  }
  return results;
}

async function collectProjects(initial?: ProjectEntry[]): Promise<ProjectEntry[]> {
  if (initial && initial.length > 0) return initial;
  const wants = await confirm({ message: "Adicionar projetos?", default: false });
  if (!wants) return [];
  const results: ProjectEntry[] = [];
  while (true) {
    const name = await input({ message: "Nome do projeto", required: true });
    const description = await input({ message: "Descrição", required: true });
    const link = await input({ message: "Link (Enter p/ pular)" });
    results.push({ name, description, link: link || undefined });
    if (!(await confirm({ message: "Adicionar outro?", default: false }))) break;
  }
  return results;
}

/** Interactive wizard for resume form data, pre-filling from `prefilled`. */
export async function collectFillResumeForm(
  prefilled: PartialSpec = {},
): Promise<{
  experiences: ExperienceEntry[];
  education: EducationEntry[];
  skills: string[];
  languages: LanguageEntry[];
  certifications: CertificationEntry[];
  projects: ProjectEntry[];
  jobDescription?: string;
  linkedinUrl?: string;
}> {
  section("LinkedIn (opcional)");
  let linkedinUrl = prefilled.linkedinUrl;
  if (!linkedinUrl) {
    const answer = await input({ message: "URL do LinkedIn (Enter p/ pular)" });
    linkedinUrl = answer.trim() || undefined;
  }

  section("Experiência profissional");
  const experiences = await collectExperiences(prefilled.experiences);

  section("Formação acadêmica");
  const education = await collectEducation(prefilled.education);

  section("Habilidades");
  let skills = prefilled.skills;
  if (!skills || skills.length === 0) {
    const raw = await input({
      message: "Habilidades (separadas por vírgula)",
      required: true,
    });
    skills = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  section("Idiomas");
  const languages = await collectLanguages(prefilled.languages);

  section("Certificações (opcional)");
  const certifications = await collectCertifications(prefilled.certifications);

  section("Projetos (opcional)");
  const projects = await collectProjects(prefilled.projects);

  section("Descrição da vaga (opcional)");
  let jobDescription = prefilled.jobDescription;
  if (jobDescription === undefined) {
    const hasJd = await confirm({
      message: "Tem uma descrição de vaga para guiar a IA?",
      default: false,
    });
    if (hasJd) {
      jobDescription = (await editor({ message: "Cole a descrição (salve e feche)" })).trim();
    }
  }

  return {
    experiences,
    education,
    skills: skills ?? [],
    languages,
    certifications,
    projects,
    jobDescription: jobDescription?.trim() || undefined,
    linkedinUrl,
  };
}
