import { describe, it, expect } from "vitest";
import { redact, safeErrorMessage, MASK } from "@/lib/safeLog";

describe("mascaramento de dados sensíveis", () => {
  it("oculta campos de identidade e contato", () => {
    const out = redact({
      name: "Joales",
      cpf_cnpj: "123.456.789-00",
      phone: "+5511999999999",
      email: "a@b.com",
      mother_name: "Maria",
      city: "São Paulo",
    }) as Record<string, unknown>;
    expect(out.name).toBe("Joales");
    expect(out.city).toBe("São Paulo");
    expect(out.cpf_cnpj).toBe(MASK);
    expect(out.phone).toBe(MASK);
    expect(out.email).toBe(MASK);
    expect(out.mother_name).toBe(MASK);
  });

  it("oculta coordenadas e segredos aninhados", () => {
    const out = redact({
      service: { id: "1", position: { latitude: -23.5, longitude: -46.6 } },
      auth: { access_token: "abc", refresh_token: "def" },
    }) as Record<string, any>;
    expect(out.service.position.latitude).toBe(MASK);
    expect(out.service.position.longitude).toBe(MASK);
    expect(out.auth.access_token).toBe(MASK);
    expect(out.auth.refresh_token).toBe(MASK);
    expect(out.service.id).toBe("1");
  });

  it("preserva listas e valores simples", () => {
    expect(redact([1, "ok", { token: "x" }])).toEqual([1, "ok", { token: MASK }]);
  });
});

describe("mensagens de erro", () => {
  it("não expõe detalhes internos", () => {
    expect(safeErrorMessage({ message: 'relation "public.profiles" does not exist (SQL)' }))
      .toBe("Não foi possível concluir. Tente novamente.");
    expect(safeErrorMessage({ message: "JWT expired" }))
      .toBe("Não foi possível concluir. Tente novamente.");
  });

  it("mantém mensagens seguras para o usuário", () => {
    expect(safeErrorMessage({ message: "E-mail ou senha inválidos" })).toBe("E-mail ou senha inválidos");
  });

  it("usa o texto padrão quando não há mensagem", () => {
    expect(safeErrorMessage(null)).toBe("Não foi possível concluir. Tente novamente.");
  });
});
