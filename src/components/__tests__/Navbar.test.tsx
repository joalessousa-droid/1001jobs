import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Navbar from "@/components/Navbar";

// Minimal mocks for hooks/components used by Navbar
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useUnreadCount", () => ({ useUnreadCount: () => 0 }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isModerator: false }) }));
vi.mock("@/components/NotificationsBell", () => ({ default: () => null }));
vi.mock("@/components/LanguageSelector", () => ({ default: () => null }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: () => {} }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("Navbar visual snapshot", () => {
  it("renders logo with responsive sizing classes that prevent overlap", () => {
    const { getByTestId, container } = render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    const logo = getByTestId("navbar-logo");
    // Responsive sizing must be present
    expect(logo.className).toMatch(/h-12/);
    expect(logo.className).toMatch(/sm:h-20/);
    expect(logo.className).toMatch(/md:h-28/);
    expect(logo.className).toMatch(/lg:h-42/);
    // Must constrain width to avoid overlap with nav items
    expect(logo.className).toMatch(/max-w-\[40vw\]/);
    // Logo container must be shrink-0 so siblings don't push into it
    expect(logo.parentElement?.className).toMatch(/shrink-0/);

    // Snapshot for regression detection
    expect(container.firstChild).toMatchSnapshot();
  });
});
