import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OfferCard } from "@/components/dispatch/OfferCard";
import type { ServiceOffer } from "@/hooks/useIncomingOffers";

function makeOffer(overrides: Partial<ServiceOffer> = {}): ServiceOffer {
  const now = Date.now();
  return {
    id: "o1",
    service_request_id: null,
    service_id: null,
    client_id: "c1",
    provider_id: "p1",
    status: "pending",
    match_score: 0.9,
    distance_km: 1.2,
    radius_km: 3,
    offered_at: new Date(now).toISOString(),
    expires_at: new Date(now + 30_000).toISOString(),
    metadata: { client_name: "Ana", description: "Test" },
    ...overrides,
  };
}

describe("OfferCard timer", () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-06-07T10:00:00Z")));
  afterEach(() => vi.useRealTimers());

  it("shows remaining seconds and expires after window", () => {
    const offered = new Date("2026-06-07T10:00:00Z").toISOString();
    const expires = new Date("2026-06-07T10:00:30Z").toISOString();
    render(<OfferCard offer={makeOffer({ offered_at: offered, expires_at: expires })} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText(/30s/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByText(/15s/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByText(/Expirou/)).toBeInTheDocument();
  });

  it("uses backend duration (offered_at -> expires_at) for progress", () => {
    const offered = new Date("2026-06-07T10:00:00Z").toISOString();
    const expires = new Date("2026-06-07T10:01:00Z").toISOString(); // 60s window from backend
    render(<OfferCard offer={makeOffer({ offered_at: offered, expires_at: expires })} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText(/60s/)).toBeInTheDocument();
  });
});
