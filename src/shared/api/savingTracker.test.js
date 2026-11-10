/** savingTracker.test.js — ป้าย "กำลังบันทึก…" ทุกหน้า: นับเฉพาะคำสั่งบันทึกที่ผู้ใช้กด (10 พ.ย. 2569) */
import { describe, it, expect, beforeEach } from "vitest";
import { isSavingRequest, beginSaving, endSaving, snapshot, subscribeSaving, __resetSaving } from "./savingTracker";

beforeEach(() => __resetSaving());

describe("savingTracker", () => {
  it("counts only save actions (POST/PUT/PATCH/DELETE) · skips reads and background calls", () => {
    expect(isSavingRequest({ method: "get", url: "/events/event-op" })).toBe(false);
    expect(isSavingRequest({ method: "put", url: "/events/123/quotation" })).toBe(true);
    expect(isSavingRequest({ method: "post", url: "/events/123/quotation/scan" })).toBe(false); // AI read has its own UI
    expect(isSavingRequest({ method: "post", url: "/push/subscribe" })).toBe(false);
    expect(isSavingRequest({ method: "put", url: "/x", silent: true })).toBe(false);
  });
  it("tracks in-flight saves and the last result · uploads are flagged", () => {
    const seen = [];
    const off = subscribeSaving((s) => seen.push(s.count));
    const a = beginSaving({ data: null });
    const b = beginSaving({ data: new FormData() });
    expect(snapshot()).toMatchObject({ count: 2, upload: true });
    endSaving(b, true);
    endSaving(a, false);
    expect(snapshot()).toMatchObject({ count: 0, lastResult: { ok: false } });
    expect(seen).toEqual([1, 2, 1, 0]);
    off();
  });
});
