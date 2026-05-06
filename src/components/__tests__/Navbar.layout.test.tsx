import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Navbar from "@/components/Navbar";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useUnreadCount", () => ({ useUnreadCount: () => 0 }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isModerator: false }) }));
vi.mock("@/components/NotificationsBell", () => ({ default: () => null }));
vi.mock("@/components/LanguageSelector", () => ({ default: () => null }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: () => {} }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("Navbar layout integrity", () => {
  const renderNav = () =>
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

  it("keeps responsive heights at all breakpoints (mobile → desktop)", () => {
    const { container } = renderNav();
    const inner = container.querySelector("nav > div") as HTMLElement;
    expect(inner).toBeTruthy();
    const cls = inner.className;
    // Mobile base + responsive heights
    expect(cls).toMatch(/\bh-20\b/);
    expect(cls).toMatch(/\bsm:h-28\b/);
    expect(cls).toMatch(/\bmd:h-36\b/);
    expect(cls).toMatch(/\blg:h-48\b/);
    // Flex row with space between, prevents stacking
    expect(cls).toMatch(/\bflex\b/);
    expect(cls).toMatch(/\bitems-center\b/);
    expect(cls).toMatch(/\bjustify-between\b/);
    // Must NOT wrap items into a new line at critical widths
    expect(cls).not.toMatch(/\bflex-wrap\b/);
  });

  it("nav menu items stay on a single line and don't wrap", () => {
    const { container } = renderNav();
    // The hidden-on-mobile menu container holds the inline nav links
    const menu = container.querySelector("div.hidden.md\\:flex") as HTMLElement;
    expect(menu).toBeTruthy();
    expect(menu.className).toMatch(/\bitems-center\b/);
    expect(menu.className).not.toMatch(/\bflex-wrap\b/);

    // Each link should be inline (no break), use whitespace-nowrap-friendly flex
    const links = menu.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => {
      expect(a.className).toMatch(/\bflex\b/);
      expect(a.className).toMatch(/\bitems-center\b/);
    });
  });

  it("logo container is shrink-0 so nav items can never overlap it", () => {
    const { getByTestId } = renderNav();
    const logo = getByTestId("navbar-logo");
    expect(logo.parentElement?.className).toMatch(/\bshrink-0\b/);
    expect(logo.className).toMatch(/max-w-\[40vw\]/);
  });
});
