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

const TONE = {
  ok: { c: "#15803d", bg: "#f0fdf4", line: "#bbf7d0", mark: "✓" },
  bad: { c: "#b91c1c", bg: "#fef2f2", line: "#fecaca", mark: "✕" },
  warn: { c: "#b45309", bg: "#fffbeb", line: "#fde68a", mark: "?" },
};

const row = (tone, title, sub, fix) => {
  const t = TONE[tone];
  return `<div style="display:flex;gap:9px;align-items:flex-start;padding:8px 10px;margin-top:6px;border-radius:10px;background:${t.bg};border:1px solid ${t.line};border-left:4px solid ${t.c}">
    <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:${t.c};color:#fff;font-size:12px;font-weight:900;display:grid;place-items:center;margin-top:1px">${t.mark}</span>
    <div style="min-width:0;flex:1">
      <div style="font-size:13px;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</div>
      ${sub ? `<div style="font-size:12.5px;color:${t.c};font-weight:700;margin-top:1px">${sub}</div>` : ""}
      ${fix ? `<div style="font-size:12px;color:#475569;margin-top:2px">→ ${fix}</div>` : ""}
    </div>
  </div>`;
};

export function closeCheckHtml(check) {
  const files = check?.files || [];
  const problems = check?.problems || [];
  const okCount = files.filter((f) => f.matches === "yes").length;
  // ปัญหาที่ไม่ใช่ "ไฟล์ผิดช่อง" (เนื้อหา Service Report · ต้องมีใบเสนอราคา) — ไฟล์ผิดช่องแสดงในรายไฟล์อยู่แล้ว
  const extra = problems.filter((p) => !["wrong_type", "unsure_type"].includes(p.code));
  const fileBad = files.filter((f) => f.matches !== "yes").length;
  const badCount = fileBad + extra.length;

  const pill = (tone, text) => `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;background:${TONE[tone].bg};color:${TONE[tone].c};font-size:12.5px;font-weight:800;border:1px solid ${TONE[tone].line}">${text}</span>`;
  const head = `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:6px">
    ${pill("ok", `✓ ถูกต้อง ${okCount} ไฟล์`)}
    ${badCount ? pill("bad", `✕ ต้องแก้ ${badCount} ข้อ`) : ""}
  </div>`;

  // จัดกลุ่มตามช่องเอกสาร (ลำดับตามที่เซิร์ฟเวอร์ส่งมา)
  const slots = [];
  files.forEach((f) => {
    let g = slots.find((s) => s.label === f.slotLabel);
    if (!g) { g = { label: f.slotLabel, rows: [] }; slots.push(g); }
    const name = esc(f.fileName || "ไม่มีชื่อไฟล์");
    const seen = esc(f.detected || "");
    if (f.matches === "yes") g.rows.push(row("ok", name, seen ? `ถูกต้อง · ${seen}` : "ถูกต้อง"));
    else if (f.matches === "no") g.rows.push(row("bad", name, `ไม่ใช่${esc(f.slotLabel)} · AI เห็นเป็น ${seen || "เอกสารอื่น"}`, "ลบไฟล์นี้ แล้วแนบไฟล์ที่ถูกต้อง"));
    else g.rows.push(row("warn", name, `AI ดูไม่ออก${seen ? ` · ${seen}` : ""}`, "ถ่ายให้ชัด หรือตรวจว่าแนบถูกช่อง"));
  });
  const slotHtml = slots.map((g) => `<div style="margin-top:10px">
    <div style="font-size:12px;font-weight:800;color:#64748b;letter-spacing:.2px">${esc(g.label)}</div>${g.rows.join("")}</div>`).join("");

  const extraHtml = extra.map((p) => {
    if (p.code === "need_quote") {
      const items = (p.items || []).slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join("");
      const more = (p.items || []).length > 6 ? `<li>และอีก ${(p.items || []).length - 6} รายการ</li>` : "";
      return row("bad", "ต้องแนบใบเสนอราคาเพิ่มเติม", `Service Report พบรายการต้องเสนอราคา ${(p.items || []).length} รายการ`, "แนบใบเสนอราคาในช่อง “ใบเสนอราคาเพิ่มเติม”")
        + (items ? `<ul style="margin:4px 0 0;padding-left:30px;font-size:12px;color:#475569;line-height:1.5">${items}${more}</ul>` : "");
    }
    if (p.code === "sr_not_found") return row("bad", "Service Report", "ไม่ใช่ใบ Service Report", "แนบใบ Service Report ที่ช่างเขียนจริง");
    if (p.code === "sr_unreadable") return row("warn", "Service Report", esc(String(p.text || "").split(" — ")[0]), "ถ่ายใหม่ให้ชัด แล้วแนบแทน");
    return row("bad", esc(p.slotLabel || "เอกสาร"), esc(p.text));
  }).join("");

  const tip = badCount ? `<div style="margin-top:12px;padding:8px 10px;border-radius:10px;background:#f8fafc;color:#475569;font-size:12px;line-height:1.5">
      เอกสารไม่มีจริง (เช่น ลูกค้าไม่ออกให้)? กด <b style="white-space:nowrap">ขอแอดมินพิจารณา</b> แล้วใส่เหตุผล</div>`
    : `<div style="margin-top:12px;color:#475569;font-size:12.5px;text-align:center">งานจะเข้าสถานะ “รอแอดมินอนุมัติ” ทันที</div>`;

  return `<div style="text-align:left">${head}${slotHtml}${extraHtml ? `<div style="margin-top:10px"><div style="font-size:12px;font-weight:800;color:#64748b">เนื้อหาเอกสาร</div>${extraHtml}</div>` : ""}${tip}</div>`;
}

export default closeCheckHtml;
