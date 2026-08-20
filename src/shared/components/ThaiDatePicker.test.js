import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import moment from "moment";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import ThaiDatePicker from "./ThaiDatePickerInner";
import { mountThaiDatePickers } from "./mountThaiDatePickers";
import { toThaiPattern, toBEYear } from "../utils/thaiDate";

class A extends AdapterMoment {
  formatByString = (date, format) => {
    const m = date.clone().locale(this.locale || "th");
    return m.format(toThaiPattern(format, toBEYear(m.year()), m.localeData()));
  };
}

describe("localized tokens", () => {
  const a = new A({ instance: moment, locale: "th" });
  const d = moment("2026-08-11");
  it("all 27 adapter formats must not contain a CE year", () => {
    const bad = [];
    for (const [k, f] of Object.entries(a.formats)) {
      const s = a.formatByString(d, f);
      if (/2026/.test(s)) bad.push(`${k}="${f}" -> ${s}`);
    }
    console.log("  fullDate            :", a.format(d, "fullDate"));
    console.log("  keyboardDate        :", a.format(d, "keyboardDate"));
    console.log("  fullDateWithWeekday :", a.format(d, "fullDateWithWeekday"));
    console.log("  monthAndYear        :", a.format(d, "monthAndYear"));
    console.log("  CE leaks            :", bad.length ? bad : "none");
    expect(bad).toEqual([]);
  });
});

describe("ThaiDatePicker DOM", () => {
  it("aria-label is Thai + BE", () => {
    render(<ThaiDatePicker label="วันที่เริ่ม" value="2026-08-11" onChange={() => {}} />);
    const btn = document.querySelector(".MuiInputAdornment-root button");
    const al = btn?.getAttribute("aria-label");
    console.log("  aria-label:", al);
    expect(al).toContain("เลือกวันที่");
    expect(al).not.toContain("2026");
    expect(al).toContain("2569");
  });

  it("clicking the text field opens the calendar", () => {
    render(<ThaiDatePicker label="วันที่สิ้นสุด" value="2026-08-11" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("textbox"));
    const cal = document.querySelector(".MuiCalendarPicker-root, .MuiPickersPopper-root");
    console.log("  opened by clicking field:", !!cal);
    console.log("  TEXT >>>", cal?.textContent.replace(/\s+/g, " ").slice(0, 90));
    expect(cal).toBeTruthy();
  });

  it("does not open when disabled", () => {
    render(<ThaiDatePicker label="ปิดอยู่" value="2026-08-11" onChange={() => {}} disabled />);
    fireEvent.click(screen.getByRole("textbox"));
    expect(document.querySelector(".MuiCalendarPicker-root, .MuiPickersPopper-root")).toBeFalsy();
  });

  it("navigation buttons are Thai", () => {
    render(<ThaiDatePicker label="x" value="2026-08-11" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("textbox"));
    const labels = [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label"));
    console.log("  aria-labels:", JSON.stringify(labels.slice(0, 6)));
    expect(labels.some((l) => /เดือนก่อนหน้า|เดือนถัดไป/.test(l))).toBe(true);
  });
});

describe("mountThaiDatePickers (ฟอร์ม SweetAlert)", () => {
  it("ซ่อน input เดิมไว้เป็นตัวเก็บค่า และเขียนค่ากลับเมื่อเลือกวัน", async () => {
    const box = document.createElement("div");
    box.innerHTML = '<input id="start" type="date" value="2026-08-11">';
    document.body.appendChild(box);
    const input = box.querySelector("#start");

    let cleanup;
    await act(async () => { cleanup = mountThaiDatePickers(box); });

    // input เดิมต้องยังอยู่ใน DOM (โค้ดเดิมอ่าน .value ตอนกดบันทึก)
    expect(box.querySelector("#start")).toBeTruthy();
    expect(input.style.display).toBe("none");

    // ช่องของ MUI โผล่มาแทน และแสดงเป็น พ.ศ.
    const tb = [...box.querySelectorAll("input")].find((el) => el.id !== "start");
    expect(tb).toBeTruthy();
    expect(tb.value).toBe("11/08/2569");

    // พิมพ์วันใหม่เป็น พ.ศ. -> input เดิมต้องได้ ค.ศ.
    await act(async () => { fireEvent.change(tb, { target: { value: "25/12/2569" } }); });
    expect(input.value).toBe("2026-12-25");

    await act(async () => { cleanup(); await new Promise((r) => setTimeout(r, 0)); });
    box.remove();
  });
});
