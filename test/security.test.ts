import { test } from "node:test";
import assert from "node:assert/strict";
import { maskCpf, maskEmail, maskPhone } from "../src/lib/security.ts";

test("maskCpf shows only last 2 digits with standard format", () => {
  assert.equal(maskCpf("12345678909"), "***.***.***-09");
  assert.equal(maskCpf("123.456.789-09"), "***.***.***-09");
});

test("maskCpf handles empty / too-short input", () => {
  assert.equal(maskCpf(""), "");
  assert.equal(maskCpf(null), "");
  assert.equal(maskCpf(undefined), "");
  assert.equal(maskCpf("123"), "***");
});

test("maskEmail shows first two chars + domain", () => {
  assert.equal(maskEmail("joao@gmail.com"), "jo***@gmail.com");
  assert.equal(maskEmail("x@y.com"), "x***@y.com");
});

test("maskEmail handles missing @", () => {
  assert.equal(maskEmail("not-an-email"), "***");
  assert.equal(maskEmail(""), "");
});

test("maskPhone keeps only last 4 digits", () => {
  assert.equal(maskPhone("11987654321"), "(**) ****-4321");
  assert.equal(maskPhone("(11) 98765-4321"), "(**) ****-4321");
});

test("maskPhone handles short/empty input", () => {
  assert.equal(maskPhone(""), "");
  assert.equal(maskPhone("12"), "***");
});
