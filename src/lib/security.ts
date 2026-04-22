export function maskCpf(cpf: string | undefined | null): string {
  if (!cpf) return "";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***.***.***-${digits.slice(-2)}`;
}

export function maskEmail(email: string | undefined | null): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `(**) ****-${digits.slice(-4)}`;
}
