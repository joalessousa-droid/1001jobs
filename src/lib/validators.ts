// Brazilian document validators (client-side).
export function onlyDigits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export function isValidCPF(input: string): boolean {
  const c = onlyDigits(input);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const nums = c.split("").map((d) => parseInt(d, 10));
  let s = 0;
  for (let i = 0; i < 9; i++) s += nums[i] * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== nums[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += nums[i] * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === nums[10];
}

export function formatCPF(input: string): string {
  const c = onlyDigits(input).slice(0, 11);
  return c
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
