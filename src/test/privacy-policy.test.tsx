import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { privacyPolicy } from "@/data/privacyPolicy";
import en from "@/data/privacyPolicy.en.json";
import es from "@/data/privacyPolicy.es.json";
import i18n from "@/i18n";
import Privacy from "@/pages/Privacy";

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
afterEach(cleanup);

describe("Complete localized privacy notice", () => {
  it.each([en, es])("preserves every section, block type, subheading and line", (doc) => {
    expect(doc.sections).toHaveLength(57);
    expect(doc.sections.map((s) => s.blocks.map((b) => ({
      type: b.type, hasHeading: "heading" in b, lines: "lines" in b ? b.lines.length : 0,
    })))).toEqual(privacyPolicy.sections.map((s) => s.blocks.map((b) => ({
      type: b.type, hasHeading: "heading" in b, lines: b.lines?.length ?? 0,
    }))));
    const originalTokens = JSON.stringify(privacyPolicy).match(/lgpd@1001jobs\.com(?:\.br)?|60\.179\.507\/0001-86|180|https:\/\/www\.gov\.br\/anpd\//g);
    expect(JSON.stringify(doc).match(/lgpd@1001jobs\.com(?:\.br)?|60\.179\.507\/0001-86|180|https:\/\/www\.gov\.br\/anpd\//g)).toEqual(originalTokens);
  });

  it.each([privacyPolicy, en, es])("keeps legal details without invented postal addresses or raw placeholders", (doc) => {
    const text = JSON.stringify(doc);
    expect(text).toContain("1001 Technologies");
    expect(text).toContain("São Luís/MA");
    expect(text).not.toMatch(/\[(RAZÃO SOCIAL|CNPJ|ENDEREÇO|PRAZO|URL|NOME|EMAIL|PRIVACIDADE|CIDADE)/);
    expect(doc.sections[33].blocks.at(-1)?.lines?.[0]).toContain("180");
    expect(doc.sections[2].blocks[3].lines?.[2]).toMatch(/pendente|pending|pendiente/);
  });

  it("switches the entire notice and open contents without reloading; regional locales use their base language", async () => {
    await act(async () => { await i18n.changeLanguage("pt"); });
    render(<Privacy />);
    fireEvent.click(screen.getByRole("button", { name: "Sumário" }));
    expect(screen.getByText("Quem somos")).toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage("en-US"); });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.title);
    expect(screen.getByRole("button", { name: "Contents" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: en.sections.at(-1)?.heading })).toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage("es"); });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(es.title);
    expect(screen.getByRole("button", { name: "Índice" })).toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage("fr"); });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(privacyPolicy.title);
  });
});