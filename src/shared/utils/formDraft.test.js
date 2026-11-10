/** formDraft.test.js — ฟอร์มแก้ไขงาน: ค่าที่ยังไม่บันทึกต้องไม่เติมให้เอง · รู้ว่าช่องไหนแก้ · ยกเลิกได้ (10 พ.ย. 2569) */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { domFormDraft, saveDraft } from "./formDraft";

const form = () => {
  const root = document.createElement("div");
  root.innerHTML = `<div id="body"></div><input id="title" value="Service"><select id="team"><option value="A">A</option><option value="B">B</option></select>`;
  document.body.appendChild(root);
  return root;
};
// ⚠️ jsdom สร้างเหตุการณ์ที่ "ผู้ใช้กดจริง" (isTrusted) ไม่ได้ — เปลี่ยนค่าตรงๆ โดยไม่ยิงเหตุการณ์ (ไม่ถูกนับเป็นค่าตั้งต้นใหม่)
const userChange = (el, value) => { el.value = value; };

beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; vi.useRealTimers(); });

describe("domFormDraft askRestore", () => {
  it("does not apply leftover unsaved edits on open · offers restore/drop instead", () => {
    saveDraft("editEvent:1", { v: 2, data: { team: "B" }, base: { team: "A" } });
    const root = form();
    const fd = domFormDraft(root, "editEvent:1", { bannerHost: "#body", askRestore: true });
    expect(fd.restore()).toBe(false);
    fd.start();
    expect(root.querySelector("#team").value).toBe("A"); // saved value shown
    expect(root.textContent).toMatch(/ยังไม่ได้บันทึก 1 ช่อง/);
    root.querySelector('[data-a="restore"]').click();
    expect(root.querySelector("#team").value).toBe("B");
  });

  it("dirtyKeys / revert / discard", () => {
    const root = form();
    const fd = domFormDraft(root, "editEvent:2", { askRestore: true });
    fd.restore(); fd.start();
    userChange(root.querySelector("#title"), "PM");
    expect(fd.dirtyKeys()).toEqual(["title"]);
    fd.revert();
    expect(root.querySelector("#title").value).toBe("Service");
    expect(fd.dirtyKeys()).toEqual([]);
    userChange(root.querySelector("#title"), "PM");
    fd.discard();
    expect(localStorage.length).toBe(0);
  });
});
