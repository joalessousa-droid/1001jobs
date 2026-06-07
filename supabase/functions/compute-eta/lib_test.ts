import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyTraffic,
  computeAdjustedEta,
  computeAvgSpeedKmh,
  resolveEmaAlpha,
} from "./lib.ts";

Deno.test("classifyTraffic — free / moderate / intense", () => {
  assertEquals(classifyTraffic(0.95), "free");
  assertEquals(classifyTraffic(1.0), "free");
  assertEquals(classifyTraffic(1.1), "moderate");
  assertEquals(classifyTraffic(1.25), "intense");
  assertEquals(classifyTraffic(null), null);
});

Deno.test("computeAvgSpeedKmh — basic + invalid", () => {
  // 10 km in 600s = 60 km/h
  assertEquals(computeAvgSpeedKmh(10_000, 600), 60);
  assertEquals(computeAvgSpeedKmh(0, 60), null);
  assertEquals(computeAvgSpeedKmh(1000, 0), null);
});

Deno.test("computeAdjustedEta — free flow, no regional history", () => {
  const r = computeAdjustedEta({
    etaTrafficSec: 600,
    staticSec: 600,
    distanceMeters: 10_000,
    regionalSpeedKmh: null,
    regionalSampleCount: null,
  });
  assertEquals(r.trafficLevel, "free");
  assertEquals(r.regionalWeight, 0);
  assertEquals(r.adjustedEtaSec, 600);
  assertEquals(r.avgSpeedKmh, 60);
});

Deno.test("computeAdjustedEta — moderate traffic with regional blend", () => {
  const r = computeAdjustedEta({
    etaTrafficSec: 700, // ~16% slower than static
    staticSec: 600,
    distanceMeters: 10_000,
    regionalSpeedKmh: 40, // ~900s regional ETA
    regionalSampleCount: 25, // weight = 25/50 = 0.5 → capped at 0.4
  });
  assertEquals(r.trafficLevel, "moderate");
  assertEquals(r.regionalWeight, 0.4);
  // 700*0.6 + 900*0.4 = 420 + 360 = 780
  assertEquals(r.adjustedEtaSec, 780);
});

Deno.test("computeAdjustedEta — intense traffic", () => {
  const r = computeAdjustedEta({
    etaTrafficSec: 900,
    staticSec: 600,
    distanceMeters: 5_000,
    regionalSpeedKmh: null,
    regionalSampleCount: null,
  });
  assertEquals(r.trafficLevel, "intense");
  assert((r.trafficFactor ?? 0) >= 1.2);
});

Deno.test("computeAdjustedEta — fallback when regional speed is too low/unreliable", () => {
  const r = computeAdjustedEta({
    etaTrafficSec: 600,
    staticSec: 600,
    distanceMeters: 10_000,
    regionalSpeedKmh: 3, // below 5 km/h threshold → ignored
    regionalSampleCount: 100,
  });
  assertEquals(r.regionalWeight, 0);
  assertEquals(r.adjustedEtaSec, 600);
});

Deno.test("resolveEmaAlpha — default and overrides", () => {
  assertEquals(resolveEmaAlpha(undefined, undefined, 1, 9), 0.2);
  assertEquals(resolveEmaAlpha("0.3", undefined, 1, 9), 0.3);
  assertEquals(resolveEmaAlpha("bad", undefined, 1, 9), 0.2);
  assertEquals(resolveEmaAlpha("0.2", '{"1:8":0.5}', 1, 8), 0.5);
  assertEquals(resolveEmaAlpha("0.2", '{"1:8":0.5}', 1, 9), 0.2);
  assertEquals(resolveEmaAlpha("0.2", "not-json", 1, 8), 0.2);
});
