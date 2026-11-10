import { describe, it, expect, afterEach } from "vitest";
import { workValueInitial, workValueCardHtml, bindWorkValueCard } from "./workValueCard";

const mount = (props, opts) => {
  const init = workValueInitial(props);
  const root = document.createElement("div");
  root.innerHTML = workValueCardHtml(init, opts);
  document.body.appendChild(root);
  const ctl = bindWorkValueCard(root, { init, eventId: "E1", EventService: null });
  return { root, ctl, init, inp: root.querySelector("#editWorkValue") };
};

describe("การ์ดมูลค่างานครั้งนี้", () => {
  afterEach(() => { document.body.innerHTML = ""; });
  it("งานสัญญาที่ยังไม่ใส่ → เติมมูลค่าสัญญา ÷ ครั้ง ให้เลย และบันทึกพร้อมแหล่งที่มา", () => {
    const { root, ctl, inp } = mount({ contractGroupId: "C1", jobValue: 41600, visitCount: 4, time: "3" });
    expect(inp.value).toBe("10,400");
    expect(root.querySelector("#ee-wv-auto").textContent).toMatch(/÷ 4 ครั้ง/);
    expect(ctl.read()).toEqual({ workValue: 10400, workValueVatIncluded: false, workValueSource: "contract" });
  });

  it("ค่าที่บันทึกแล้วไม่เปลี่ยน = ไม่ส่งอะไร · สลับเป็นรวม VAT = ส่งเฉพาะธง VAT", () => {
    const { root, ctl } = mount({ workValue: 10700, workValueVatIncluded: false });
    expect(ctl.read()).toEqual({});
    root.querySelector('input[name="editWorkValueVat"][value="1"]').checked = true;
    expect(ctl.read()).toEqual({ workValueVatIncluded: true });
    expect(root.querySelector("#ee-wv-auto")).toBeNull();
  });

  it("ล้างค่า = ส่ง null · ตัวเลขผิด = ไม่ส่ง", () => {
    const { ctl, inp } = mount({ workValue: 5000 });
    inp.value = "";
    expect(ctl.read()).toEqual({ workValue: null, workValueSource: "" });
    inp.value = "abc";
    expect(ctl.read()).toEqual({});
  });

  it("ใบเสนอราคาที่ได้งานแบบรวม VAT → เลือก 'รวม VAT' ให้อัตโนมัติ", () => {
    const { root, ctl } = mount({ quotationStatus: "approved", quotationAmount: 21400, quotationVatIncluded: true });
    expect(root.querySelector('input[name="editWorkValueVat"][value="1"]').checked).toBe(true);
    expect(ctl.read()).toMatchObject({ workValue: 21400, workValueVatIncluded: true, workValueSource: "quotation" });
  });

  it("ดูอย่างเดียว = แสดงเฉพาะค่าที่บันทึกจริง ไม่เติมค่าอัตโนมัติ", () => {
    const { inp, ctl } = mount({ contractGroupId: "C1", jobValue: 40000, visitCount: 4, time: "1" }, { disabled: true });
    expect(inp.value).toBe("");
    expect(ctl.read()).toEqual({});
  });
});
