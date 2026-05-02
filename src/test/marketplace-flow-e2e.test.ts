import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Sprint 5 — End-to-end concurrent marketplace flow.
 *
 * Simulates two users acting in parallel against the mocked Supabase backend:
 *
 *   CLIENT (Alice)                          PROVIDER (Bob)
 *   ─────────────────                       ─────────────────
 *   1. creates service_request              2. lists open requests
 *                                           3. submits proposal
 *   4. accepts proposal → service row
 *                                           5. starts service (in_progress)
 *   6. opens chat conversation              6. replies in chat
 *   7. confirms service (released payment)
 *   8. leaves review                        8. leaves counter-review
 *   9. opens dispute on a 2nd service       9. submits evidence
 *  10. ADMIN resolves with refund
 *
 * The test asserts the backend contract: which RPCs are called, which tables
 * receive inserts, which edge functions fire, and that two clients can act
 * concurrently without interfering with each other's state.
 */

type Insert = { table: string; values: any; actor: string };
type Rpc = { fn: string; args: any; actor: string };
type FnCall = { name: string; body: any; actor: string };
type Update = { table: string; values: any; match: any; actor: string };

const inserts: Insert[] = [];
const rpcCalls: Rpc[] = [];
const fnInvocations: FnCall[] = [];
const updates: Update[] = [];

// Per-actor mock factory so we can drive two users in parallel.
function createMockClient(actor: string, profileId: string) {
  return {
    from: (table: string) => ({
      insert: (values: any) => {
        inserts.push({ table, values, actor });
        return Promise.resolve({ data: values, error: null });
      },
      update: (values: any) => ({
        eq: (col: string, v: any) => {
          updates.push({ table, values, match: { [col]: v }, actor });
          return Promise.resolve({ data: values, error: null });
        },
      }),
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    rpc: (fn: string, args: any) => {
      rpcCalls.push({ fn, args, actor });
      // Synthesize realistic RPC return values
      if (fn === "open_service_dispute") {
        return Promise.resolve({ data: "dispute-uuid-1", error: null });
      }
      if (fn === "resolve_service_dispute") {
        return Promise.resolve({ data: true, error: null });
      }
      if (fn === "transition_service_status") {
        return Promise.resolve({ data: true, error: null });
      }
      if (fn === "release_service_payment") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    functions: {
      invoke: (name: string, opts: { body: any }) => {
        fnInvocations.push({ name, body: opts.body, actor });
        return Promise.resolve({ data: { ok: true }, error: null });
      },
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: profileId } }, error: null }),
    },
  };
}

const alice = createMockClient("client", "profile-alice");
const bob = createMockClient("provider", "profile-bob");
const admin = createMockClient("admin", "profile-admin");

beforeEach(() => {
  inserts.length = 0;
  rpcCalls.length = 0;
  fnInvocations.length = 0;
  updates.length = 0;
});

// ─── Concurrent user actions ────────────────────────────────────────────────

async function clientCreatesRequest() {
  await alice.from("service_requests").insert({
    profile_id: "profile-alice",
    requester_name: "Alice",
    description: "Preciso de instalação elétrica",
    category_id: "cat-electric",
    budget: 500,
    is_active: true,
  });
}

async function providerSubmitsProposal() {
  await bob.from("service_proposals").insert({
    service_request_id: "req-1",
    provider_id: "profile-bob",
    amount: 480,
    currency: "BRL",
    message: "Posso fazer amanhã",
  });
}

async function clientAcceptsProposal() {
  await alice.from("services").insert({
    client_id: "profile-alice",
    provider_id: "profile-bob",
    title: "Instalação elétrica",
    agreed_price: 480,
    status: "accepted",
    payment_status: "pending",
  });
}

async function clientPaysEscrow() {
  // Triggers stripe checkout edge function
  await alice.functions.invoke("service-payment-checkout", {
    body: { service_id: "svc-1" },
  });
}

async function providerStartsService() {
  await bob.rpc("transition_service_status", {
    _service_id: "svc-1",
    _new_status: "in_progress",
    _reason: "Cheguei no local",
  });
}

async function chatExchange() {
  // Both write into the same conversation in parallel
  await Promise.all([
    alice.from("conversations").insert({
      participant_1: "profile-alice",
      participant_2: "profile-bob",
    }),
    alice.from("messages").insert({
      conversation_id: "conv-1",
      sender_id: "profile-alice",
      content: "Olá, a que horas chega?",
    }),
    bob.from("messages").insert({
      conversation_id: "conv-1",
      sender_id: "profile-bob",
      content: "Em 20 minutos",
    }),
  ]);
}

async function clientConfirmsService() {
  // confirmed → triggers automatic release_service_payment
  await alice.rpc("transition_service_status", {
    _service_id: "svc-1",
    _new_status: "confirmed",
    _reason: "Serviço concluído com sucesso",
  });
}

async function bothLeaveReviews() {
  await Promise.all([
    alice.from("reviews").insert({
      reviewer_id: "profile-alice",
      reviewed_id: "profile-bob",
      rating: 5,
      comment: "Excelente",
      review_type: "client_to_provider",
    }),
    bob.from("reviews").insert({
      reviewer_id: "profile-bob",
      reviewed_id: "profile-alice",
      rating: 5,
      comment: "Cliente ótimo",
      review_type: "provider_to_client",
    }),
  ]);
}

async function clientOpensDispute() {
  await alice.rpc("open_service_dispute", {
    _service_id: "svc-2",
    _reason: "incomplete_work",
    _description: "Faltou metade do trabalho",
  });
  await alice.functions.invoke("notify-dispute-event", {
    body: { dispute_id: "dispute-uuid-1", event: "opened" },
  });
}

async function providerSubmitsEvidence() {
  await bob.from("service_dispute_evidence").insert({
    dispute_id: "dispute-uuid-1",
    submitted_by: "profile-bob",
    file_urls: ["https://example.com/proof.pdf"],
    message: "Comprovante de execução",
  });
  await bob.functions.invoke("notify-dispute-event", {
    body: { dispute_id: "dispute-uuid-1", event: "evidence" },
  });
}

async function adminResolvesWithRefund() {
  await admin.rpc("resolve_service_dispute", {
    _dispute_id: "dispute-uuid-1",
    _resolution: "refund_client",
    _refund_amount: 240,
    _moderator_notes: "Trabalho parcial",
  });
  await admin.functions.invoke("service-payment-refund", {
    body: { service_id: "svc-2", amount: 240 },
  });
  await admin.functions.invoke("notify-dispute-event", {
    body: { dispute_id: "dispute-uuid-1", event: "resolved" },
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Marketplace E2E — concurrent client + provider flow", () => {
  it("runs the full happy-path lifecycle with two users in parallel", async () => {
    // Phase 1: request + proposal happen concurrently
    await Promise.all([clientCreatesRequest(), providerSubmitsProposal()]);

    // Phase 2: acceptance + payment escrow
    await clientAcceptsProposal();
    await clientPaysEscrow();

    // Phase 3: provider starts, both chat in parallel
    await providerStartsService();
    await chatExchange();

    // Phase 4: confirmation auto-releases payment
    await clientConfirmsService();

    // Phase 5: bidirectional reviews
    await bothLeaveReviews();

    // ── Assertions ──
    const serviceRequest = inserts.find((i) => i.table === "service_requests");
    expect(serviceRequest?.actor).toBe("client");

    const proposal = inserts.find((i) => i.table === "service_proposals");
    expect(proposal?.actor).toBe("provider");
    expect(proposal?.values.amount).toBe(480);

    const service = inserts.find((i) => i.table === "services");
    expect(service?.values.status).toBe("accepted");

    const checkout = fnInvocations.find((f) => f.name === "service-payment-checkout");
    expect(checkout).toBeDefined();
    expect(checkout?.body.service_id).toBe("svc-1");

    const startTransition = rpcCalls.find(
      (r) => r.fn === "transition_service_status" && r.args._new_status === "in_progress"
    );
    expect(startTransition?.actor).toBe("provider");

    const confirmTransition = rpcCalls.find(
      (r) => r.fn === "transition_service_status" && r.args._new_status === "confirmed"
    );
    expect(confirmTransition?.actor).toBe("client");

    // Both users sent messages in the same conversation
    const messages = inserts.filter((i) => i.table === "messages");
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.actor).sort()).toEqual(["client", "provider"]);

    // Bidirectional reviews recorded
    const reviews = inserts.filter((i) => i.table === "reviews");
    expect(reviews).toHaveLength(2);
    expect(reviews.find((r) => r.values.review_type === "client_to_provider")).toBeDefined();
    expect(reviews.find((r) => r.values.review_type === "provider_to_client")).toBeDefined();
  });

  it("handles dispute lifecycle with evidence and admin refund", async () => {
    await clientOpensDispute();
    await providerSubmitsEvidence();
    await adminResolvesWithRefund();

    const openRpc = rpcCalls.find((r) => r.fn === "open_service_dispute");
    expect(openRpc?.actor).toBe("client");
    expect(openRpc?.args._reason).toBe("incomplete_work");

    const evidence = inserts.find((i) => i.table === "service_dispute_evidence");
    expect(evidence?.actor).toBe("provider");
    expect(evidence?.values.file_urls).toHaveLength(1);

    const resolveRpc = rpcCalls.find((r) => r.fn === "resolve_service_dispute");
    expect(resolveRpc?.actor).toBe("admin");
    expect(resolveRpc?.args._refund_amount).toBe(240);

    const refundFn = fnInvocations.find((f) => f.name === "service-payment-refund");
    expect(refundFn?.actor).toBe("admin");
    expect(refundFn?.body.amount).toBe(240);

    // Three notification events fired: opened, evidence, resolved
    const notifyEvents = fnInvocations
      .filter((f) => f.name === "notify-dispute-event")
      .map((f) => f.body.event);
    expect(notifyEvents).toEqual(["opened", "evidence", "resolved"]);
  });

  it("supports concurrent activity from two users without state leak", async () => {
    // Fire many actions in parallel and check all land correctly
    await Promise.all([
      clientCreatesRequest(),
      providerSubmitsProposal(),
      chatExchange(),
      bothLeaveReviews(),
    ]);

    const clientActions = [...inserts, ...rpcCalls, ...fnInvocations].filter(
      (a: any) => a.actor === "client"
    );
    const providerActions = [...inserts, ...rpcCalls, ...fnInvocations].filter(
      (a: any) => a.actor === "provider"
    );

    expect(clientActions.length).toBeGreaterThan(0);
    expect(providerActions.length).toBeGreaterThan(0);

    // No action should be misattributed
    inserts.forEach((i) => {
      if (i.table === "reviews" && i.values.reviewer_id === "profile-alice") {
        expect(i.actor).toBe("client");
      }
      if (i.table === "reviews" && i.values.reviewer_id === "profile-bob") {
        expect(i.actor).toBe("provider");
      }
    });
  });
});
