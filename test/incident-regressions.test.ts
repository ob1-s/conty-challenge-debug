import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";
import { seedIncident } from "../src/seed.ts";

describe("regressões do incidente", () => {
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = openDatabase(":memory:");
    seedIncident(db);
    app = createApp(db);
  });

  afterEach(() => db.close());

  function approve(missionId: string, approvedAt: string, key: string) {
    return app.request("/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mission_id: missionId,
        approved_at: approvedAt,
        idempotency_key: key,
      }),
    });
  }

  it.each([
    {
      name: "aceita o último instante do prazo em São Paulo",
      approvedAt: "2026-03-13T02:59:59.999Z",
      expectedStatus: 201,
    },
    {
      name: "recusa o primeiro instante do dia seguinte em São Paulo",
      approvedAt: "2026-03-13T03:00:00.000Z",
      expectedStatus: 409,
    },
  ])("$name", async ({ approvedAt, expectedStatus }) => {
    const response = await approve("msn_1842", approvedAt, "pay_boundary");
    expect(response.status).toBe(expectedStatus);
  });

  it("reutiliza o crédito no retry com U+200B registrado no log", async () => {
    const first = await approve(
      "msn_2044",
      "2026-03-12T21:05:00.000Z",
      "pay_7c1",
    );
    expect(first.status).toBe(201);

    const retry = await approve(
      "msn_2044",
      "2026-03-12T21:05:00.000Z",
      "pay_7c1\u200B",
    );
    expect(retry.status).toBe(200);

    const response = await app.request("/missions/msn_2044");
    const mission = (await response.json()) as { ledger: unknown[] };
    expect(mission.ledger).toHaveLength(1);
  });
});
