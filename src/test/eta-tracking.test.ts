import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const invokeMock = vi.fn();
  return { invokeMock };
});

vi.mock("@/integrations/supabase/client", () => {
  const builder = () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    upsert: async () => ({ data: null, error: null }),
  });
  return {
    supabase: {
      from: () => builder(),
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => {},
      functions: { invoke: mocks.invokeMock },
    },
  };
});

import { renderHook, act, waitFor } from "@testing-library/react";
import { useServiceTracking } from "@/hooks/useServiceTracking";

describe("useServiceTracking — integration with compute-eta", () => {
  beforeEach(() => {
    mocks.invokeMock.mockReset();
  });

  it("exposes the tracking contract including degraded state", async () => {
    const { result } = renderHook(() => useServiceTracking("svc-1", "prov-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.degraded).toBe(false);
    expect(result.current.etaHistory).toEqual([]);
    expect(typeof result.current.setDestination).toBe("function");
  });

  it("does not invoke compute-eta when destination is missing", async () => {
    renderHook(() => useServiceTracking("svc-1", "prov-1"));
    await waitFor(() => expect(mocks.invokeMock).not.toHaveBeenCalled());
  });

  it("can persist a destination via setDestination", async () => {
    const { result } = renderHook(() => useServiceTracking("svc-1", "prov-1"));
    await act(async () => {
      await result.current.setDestination(-23.55, -46.63);
    });
    expect(result.current.destination).toEqual({ lat: -23.55, lng: -46.63, address: undefined });
  });
});
