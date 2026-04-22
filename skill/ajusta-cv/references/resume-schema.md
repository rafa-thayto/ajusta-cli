# Resume Schema — `ajusta create --from <file>`

The `--from` flag accepts a JSON file matching this schema. Every field is optional except those marked **required**. Agents build this JSON from user conversation, then pass it to `ajusta create --from resume.json --json`.

## Schema

```jsonc
{
  "name":          "string — required — full legal name (2-100 chars)",
  "email":         "string — required — contact email, CV is delivered here",
  "cpf":           "string — required — 11 digits, numbers only",
  "phone":         "string — required — 10-11 digits, numbers only (DDD + number)",
  "language":      "pt-BR | en | es | fr | de | it (default: pt-BR)",
  "couponCode":    "string | null — discount code",

  "jobDescription": "string | null — target job posting text, max 5000 chars",
  "linkedinUrl":    "string | null — full LinkedIn profile URL",
  "summary":        "string | null — max 500 chars; if omitted, AI generates",

  "experiences": [
    {
      "role":        "string — required",
      "company":     "string — required",
      "startDate":   "string — required — 'MM/AAAA'",
      "endDate":     "string | null — 'MM/AAAA' or omit if current=true",
      "current":     "boolean — true means currently employed",
      "description": "string — required — bullet points separated by \\n; start with action verbs",
      "location":    "string | null — e.g. 'São Paulo, SP' or 'Remote'"
    }
  ],

  "education": [
    {
      "institution": "string — required",
      "course":      "string — required — e.g. 'Bacharelado em Ciência da Computação'",
      "startYear":   "string — required — 'AAAA'",
      "endYear":     "string | null — 'AAAA'",
      "ongoing":     "boolean — true means in progress",
      "description": "string | null — honors, thesis, highlights"
    }
  ],

  "skills": ["string — one skill per item — e.g. 'TypeScript', 'PostgreSQL'"],

  "languages": [
    {
      "language": "string — e.g. 'Português', 'English'",
      "level":    "Básico | Intermediário | Avançado | Fluente | Nativo"
    }
  ],

  "certifications": [
    {
      "name":        "string — required",
      "institution": "string | null",
      "year":        "string | null — 'AAAA'",
      "url":         "string | null"
    }
  ],

  "projects": [
    {
      "name":         "string — required",
      "description":  "string — required — 1-3 sentences",
      "link":         "string | null",
      "technologies": ["string"]
    }
  ]
}
```

## Constraints

| Field | Max length | Notes |
|---|---|---|
| `name` | 100 chars | No honorifics |
| `email` | 254 chars | Must be deliverable — CV email goes here |
| `cpf` | 11 digits | Server validates checksum |
| `phone` | 11 digits | Brazilian DDD (2) + number (8-9) |
| `jobDescription` | 5000 chars | Server truncates beyond this |
| `experiences[].description` | 3000 chars | Aim for 3-5 action-verb bullets per role |
| `skills` | 50 items | Group generic + technical; order by relevance |
| `summary` | 500 chars | Used verbatim if provided; AI still polishes |

**Minimum viable resume** (everything else is optional): `name`, `email`, `cpf`, `phone`, at least one `experiences` entry with `role`, `company`, `startDate`, `description`.

## Complete realistic example — Backend Engineer, São Paulo, pt-BR

```json
{
  "name": "Carlos Eduardo Ferreira",
  "email": "carlos.ferreira@gmail.com",
  "cpf": "12345678909",
  "phone": "11987654321",
  "language": "pt-BR",
  "jobDescription": "Buscamos Engenheiro de Software Backend Sênior com experiência em Node.js, TypeScript, PostgreSQL e AWS. Será responsável por desenhar e implementar microsserviços escaláveis, liderar revisões de código e trabalhar em squads ágeis.",
  "linkedinUrl": "https://www.linkedin.com/in/carlos-ferreira-dev",

  "experiences": [
    {
      "role": "Engenheiro de Software Sênior",
      "company": "Nubank",
      "startDate": "03/2022",
      "current": true,
      "location": "São Paulo, SP (Remoto)",
      "description": "Desenvolvi microsserviço de antifraude em Clojure/Kafka, reduzindo falsos positivos em 18%.\nLiderei migração de monólito legado para 6 microsserviços Node.js, aumentando throughput em 3×.\nImplementei pipeline de CI/CD com GitHub Actions + Terraform, reduzindo deploy time de 45 min para 8 min.\nOrientei 3 engenheiros juniores em sessões semanais de pair programming e code review."
    },
    {
      "role": "Engenheiro de Software Pleno",
      "company": "Totvs",
      "startDate": "06/2019",
      "endDate": "02/2022",
      "location": "São Paulo, SP",
      "description": "Construí APIs REST em Node.js/TypeScript consumidas por mais de 400 clientes enterprise.\nOtimizei queries PostgreSQL críticas, reduzindo tempo médio de resposta de 1,2s para 180ms.\nDesenvolvi sistema de cache com Redis, diminuindo carga no banco em 60% nos horários de pico.\nParticipei de migração para AWS ECS, garantindo zero downtime durante a transição."
    }
  ],

  "education": [
    {
      "institution": "Universidade de São Paulo (USP)",
      "course": "Bacharelado em Ciência da Computação",
      "startYear": "2013",
      "endYear": "2017",
      "description": "Trabalho de conclusão: Detecção de anomalias em séries temporais com LSTM. Menção honrosa."
    }
  ],

  "skills": [
    "Node.js", "TypeScript", "JavaScript", "Java", "Clojure",
    "PostgreSQL", "MongoDB", "Redis", "Kafka",
    "AWS (ECS, Lambda, RDS, S3)", "Docker", "Kubernetes", "Terraform",
    "GitHub Actions", "REST APIs", "GraphQL", "Microsserviços",
    "Git", "Linux", "Agile/Scrum"
  ],

  "languages": [
    { "language": "Português", "level": "Nativo" },
    { "language": "English", "level": "Avançado" },
    { "language": "Español", "level": "Básico" }
  ],

  "certifications": [
    {
      "name": "AWS Certified Solutions Architect – Associate",
      "institution": "Amazon Web Services",
      "year": "2023"
    }
  ],

  "projects": [
    {
      "name": "open-pix-sdk",
      "description": "SDK open-source em TypeScript para integração com a API PIX do OpenPix, com 400+ estrelas no GitHub.",
      "link": "https://github.com/carlos-ferreira/open-pix-sdk",
      "technologies": ["TypeScript", "Node.js", "PIX"]
    }
  ]
}
```
