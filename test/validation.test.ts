import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCheckout, validateResume } from "../src/lib/validation.ts";

test("validateCheckout accepts a minimal valid spec", () => {
  const result = validateCheckout({
    name: "João",
    email: "j@x.com",
    cpf: "12345678909",
    phone: "11987654321",
    language: "pt-BR",
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateCheckout strips non-digit CPF/phone characters before length check", () => {
  const result = validateCheckout({
    name: "João",
    email: "j@x.com",
    cpf: "123.456.789-09",
    phone: "(11) 98765-4321",
  });
  assert.equal(result.valid, true);
});

test("validateCheckout reports each missing required field", () => {
  const result = validateCheckout({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("name")));
  assert.ok(result.errors.some((e) => e.includes("email")));
  assert.ok(result.errors.some((e) => e.includes("cpf")));
  assert.ok(result.errors.some((e) => e.includes("phone")));
});

test("validateCheckout rejects malformed emails", () => {
  const result = validateCheckout({
    name: "X",
    email: "not-an-email",
    cpf: "12345678909",
    phone: "11987654321",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("email")));
});

test("validateCheckout rejects unknown languages", () => {
  const result = validateCheckout({
    name: "X",
    email: "a@b.co",
    cpf: "12345678909",
    phone: "11987654321",
    language: "klingon",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("language")));
});

test("validateResume requires at least one experience", () => {
  const result = validateResume({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("experiences")));
});

test("validateResume surfaces per-field errors for incomplete experiences", () => {
  const result = validateResume({
    experiences: [{ role: "", company: "", startDate: "", description: "" } as any],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("experiences[0].role")));
  assert.ok(result.errors.some((e) => e.includes("experiences[0].company")));
  assert.ok(result.errors.some((e) => e.includes("experiences[0].startDate")));
  assert.ok(result.errors.some((e) => e.includes("experiences[0].description")));
});

test("validateResume passes a complete minimal spec", () => {
  const result = validateResume({
    experiences: [
      {
        role: "Dev",
        company: "X",
        startDate: "01/2020",
        description: "Bullet.",
      },
    ],
  });
  assert.equal(result.valid, true);
});

test("validateResume checks education and language entries", () => {
  const result = validateResume({
    experiences: [{ role: "R", company: "C", startDate: "01/2020", description: "D" }],
    education: [{ institution: "", course: "", startYear: "2020" } as any],
    languages: [{ language: "", level: "" } as any],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("education[0].institution")));
  assert.ok(result.errors.some((e) => e.includes("languages[0].language")));
});
