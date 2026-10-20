import { describe, expect, it } from "vitest";
import { newRun, parseRun, settle, type InviteRunBody } from "./invite-run";

const body = (email: string): InviteRunBody => ({
  email,
  role_id: "role-employee",
  department_id: "dept-eng",
  title: "Engineer",
});
const opts = { tenantId: "t1", userId: "u1", withHandout: false, now: 1000 };

describe("invite run record", () => {
  it("settling removes the address from the remainder and counts the outcome", () => {
    let run = newRun([body("a@x.test"), body("b@x.test"), body("c@x.test")], opts);
    run = settle(run, "a@x.test", { ok: true });
    run = settle(run, "b@x.test", { ok: false, reason: "Already invited" });
    expect(run.remaining.map((b) => b.email)).toEqual(["c@x.test"]);
    expect(run.created).toBe(1);
    expect(run.failed).toEqual([{ email: "b@x.test", reason: "Already invited" }]);
    expect(run.total).toBe(3);
  });

  it("settling an address twice changes nothing the second time", () => {
    let run = newRun([body("a@x.test")], opts);
    run = settle(run, "a@x.test", { ok: true });
    const again = settle(run, "a@x.test", { ok: true });
    expect(again).toBe(run);
    expect(again.created).toBe(1);
  });

  it("reads back a cut-short run for the same admin in the same org", () => {
    const run = settle(newRun([body("a@x.test"), body("b@x.test")], opts), "a@x.test", { ok: true });
    const back = parseRun(JSON.stringify(run), "t1", "u1");
    expect(back?.remaining.map((b) => b.email)).toEqual(["b@x.test"]);
    expect(back?.created).toBe(1);
  });

  it("ignores another account's run, a finished one, and junk", () => {
    const run = newRun([body("a@x.test")], opts);
    expect(parseRun(JSON.stringify(run), "t1", "someone-else")).toBeNull();
    expect(parseRun(JSON.stringify(run), "t2", "u1")).toBeNull();
    const done = settle(run, "a@x.test", { ok: true });
    expect(parseRun(JSON.stringify(done), "t1", "u1")).toBeNull();
    expect(parseRun("{not json", "t1", "u1")).toBeNull();
    expect(parseRun(JSON.stringify({ v: 2 }), "t1", "u1")).toBeNull();
    expect(parseRun(null, "t1", "u1")).toBeNull();
  });
});
