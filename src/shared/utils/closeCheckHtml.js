/**
 * closeCheckHtml — ผลตรวจเอกสารด้วย AI ก่อนขอปิดงาน (เนื้อหาในกล่อง Swal ฝั่งช่าง)
 *
 * ✅ (26 ต.ค. 2569 ผู้ใช้: "การแจ้งเตือนการเช็คประเภทไฟล์ ให้ดูง่ายขึ้น แยกสีชัดเจน เขียวคือไฟล์ที่ถูก
 *    ส้มหรือแดง AI ตรวจว่าไม่ถูก อธิบายให้กระทัดรัดเข้าใจง่าย")
 *    • แถบสรุปบนสุด: ถูกต้องกี่ไฟล์ · ต้องแก้กี่ข้อ
 *    • รายไฟล์แยกตามช่อง: 🟢 ถูกต้อง · 🔴 ผิดประเภท · 🟠 AI ดูไม่ออก — บรรทัดเดียวว่า AI เห็นเป็นอะไร + วิธีแก้สั้นๆ
 *    • ปัญหาเนื้อหา Service Report / ต้องแนบใบเสนอราคาเพิ่มเติม ต่อท้ายในรูปแบบเดียวกัน
 * ⚠️ ไม่มี import — ใช้ได้ทั้งในแอปและหน้าทดสอบภาพ
 * @param check ผลจาก POST /events/:id/close-check { ok, files[{slotLabel, fileName, matches, detected}], problems[{code, slotLabel, text, items}] }
 */
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// 🔁 (26 ต.ค. 2569 ผู้ใช้: "สีดูรกเกินไป ไม่มืออาชีพ") — รายการขาวเส้นคั่นบางชุดเดียว ไม่มีพื้นสี/ขอบหนา
//    สีเหลือแค่ไอคอนเล็กกับคำสถานะท้ายแถว · ปัญหาขึ้นก่อน ไฟล์ที่ถูกต้องอยู่ท้าย
const TONE = {
  ok: { c: "#16a34a", label: "ถูกต้อง", icon: '<path d="M5 10.5l3 3 7-7"/>' },
  bad: { c: "#dc2626", label: "ต้องแก้", icon: '<path d="M6 6l8 8M14 6l-8 8"/>' },
  warn: { c: "#d97706", label: "ไม่ชัด", icon: '<path d="M10 5.5v5.5"/><path d="M10 14.2v.3"/>' },
};
const ORDER = { bad: 0, warn: 1, ok: 2 };
const icon = (t) => `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="${t.c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><circle cx="10" cy="10" r="8.5" stroke-width="1.5"/>${t.icon}</svg>`;

const row = ({ tone, title, sub, fix, extra = "" }) => {
  const t = TONE[tone];
  return `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-top:1px solid #eef2f6">
    ${icon(t)}
    <div style="min-width:0;flex:1">
      <div style="font-size:13px;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</div>
      ${sub ? `<div style="font-size:12px;color:#64748b;margin-top:1px">${sub}</div>` : ""}
      ${fix ? `<div style="font-size:12px;color:#334155;margin-top:3px">${fix}</div>` : ""}
      ${extra}
    </div>
    <span style="flex-shrink:0;font-size:11.5px;font-weight:700;color:${t.c};margin-top:1px">${t.label}</span>
  </div>`;
};

export function closeCheckHtml(check) {
  const files = check?.files || [];
  const problems = check?.problems || [];
  const okCount = files.filter((f) => f.matches === "yes").length;
  // ปัญหาที่ไม่ใช่ "ไฟล์ผิดช่อง" (เนื้อหา Service Report · ต้องมีใบเสนอราคา) — ไฟล์ผิดช่องแสดงในรายไฟล์อยู่แล้ว
  const extra = problems.filter((p) => !["wrong_type", "unsure_type"].includes(p.code));
  const badCount = files.filter((f) => f.matches !== "yes").length + extra.length;

  const rows = files.map((f) => {
    const name = esc(f.fileName || "ไม่มีชื่อไฟล์");
    const slot = esc(f.slotLabel || "");
    const seen = esc(f.detected || "");
    if (f.matches === "yes") return { tone: "ok", title: name, sub: `${slot}${seen ? ` · ${seen}` : ""}` };
    if (f.matches === "no") return { tone: "bad", title: name, sub: `ช่อง ${slot} · AI เห็นเป็น ${seen || "เอกสารอื่น"}`, fix: "ลบไฟล์นี้ แล้วแนบไฟล์ที่ถูกต้อง" };
    return { tone: "warn", title: name, sub: `ช่อง ${slot}${seen ? ` · ${seen}` : ""}`, fix: "ถ่ายใหม่ให้ชัด หรือตรวจว่าแนบถูกช่อง" };
  });
  extra.forEach((p) => {
    if (p.code === "need_quote") {
      const list = p.items || [];
      const items = list.slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join("") + (list.length > 6 ? `<li>และอีก ${list.length - 6} รายการ</li>` : "");
      rows.push({ tone: "bad", title: "ต้องแนบใบเสนอราคาเพิ่มเติม", sub: `Service Report พบรายการต้องเสนอราคา ${list.length} รายการ`,
        extra: items ? `<ul style="margin:4px 0 0;padding-left:18px;font-size:12px;color:#475569;line-height:1.55">${items}</ul>` : "" });
    } else if (p.code === "sr_not_found") rows.push({ tone: "bad", title: "Service Report", sub: "AI อ่านแล้วไม่ใช่ใบ Service Report", fix: "แนบใบ Service Report ที่ช่างเขียนจริง" });
    else if (p.code === "sr_unreadable") rows.push({ tone: "warn", title: "Service Report", sub: esc(String(p.text || "").split(" — ")[0]), fix: "ถ่ายใหม่ให้ชัด แล้วแนบแทน" });
    else rows.push({ tone: "bad", title: esc(p.slotLabel || "เอกสาร"), sub: esc(p.text) });
  });
  rows.sort((x, y) => ORDER[x.tone] - ORDER[y.tone]);

  const head = `<div style="font-size:12.5px;color:#64748b;text-align:center;margin-bottom:10px">
    ตรวจ ${files.length} ไฟล์ · ถูกต้อง <b style="color:#16a34a">${okCount}</b>${badCount ? ` · ต้องแก้ <b style="color:#dc2626">${badCount}</b>` : ""}</div>`;
  const list = `<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff"><div style="margin-top:-1px">${rows.map(row).join("")}</div></div>`;
  const tip = badCount
    ? `<div style="margin-top:10px;color:#64748b;font-size:12px;line-height:1.5">เอกสารไม่มีจริง (เช่น ลูกค้าไม่ออกให้) — กด <b style="white-space:nowrap;color:#334155">ขอแอดมินพิจารณา</b> แล้วใส่เหตุผล</div>`
    : `<div style="margin-top:10px;color:#64748b;font-size:12px;text-align:center">งานจะเข้าสถานะ “รอแอดมินอนุมัติ” ทันที</div>`;
  return `<div style="text-align:left">${head}${list}${tip}</div>`;
}

export default closeCheckHtml;
