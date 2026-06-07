import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { retryWithBackoff } from "./lib.ts";

Deno.test("retryWithBackoff returns on first success", async () => {
  let calls = 0;
  const r = await retryWithBackoff(async () => { calls++; return "ok"; }, { sleep: async () => {} });
  assertEquals(r.value, "ok");
  assertEquals(r.attempts, 1);
  assertEquals(calls, 1);
});

Deno.test("retryWithBackoff retries until success and applies jitter", async () => {
  let calls = 0;
  const delays: number[] = [];
  const r = await retryWithBackoff(async () => {
    calls++;
    if (calls < 3) throw Object.assign(new Error("boom"), { status: 503 });
    return 42;
  }, {
    retries: 3, baseMs: 100, capMs: 800,
    sleep: async (ms) => { delays.push(ms); },
    rand: () => 0.5, // deterministic
  });
  assertEquals(r.value, 42);
  assertEquals(r.attempts, 3);
  // Two retries happened with full jitter delays = round(0.5 * base * 2^(attempt-1))
  assertEquals(delays, [50, 100]);
});

Deno.test("retryWithBackoff bails when shouldRetry=false", async () => {
  let calls = 0;
  await assertRejects(async () => {
    await retryWithBackoff(async () => {
      calls++;
      throw Object.assign(new Error("4xx"), { status: 400 });
    }, {
      retries: 3,
      shouldRetry: (err: any) => err?.status >= 500,
      sleep: async () => {},
    });
  });
  assertEquals(calls, 1);
});
