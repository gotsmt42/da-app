/**
 * ContractNav — ตัวเลือกมุมมองของหน้า "ภาพรวมงาน" (แทนการ์ดตัวเลข 6-8 ใบ + ปุ่มสลับหน้าเดิม)
 *
 * ✅ ผู้ใช้สั่ง (8 ต.ค. 2569): "งานสัญญาไหนที่เข้าครบแล้ว หรือสัญญาไหนที่หมดอายุ เด้งออกไปแสดงหน้าอื่น
 *    โดยเมนูกำกับแสดงชัดเจนไม่กำกวม · ตัดหมวดหมู่ให้ถูกต้อง งานสัญญา งานทั่วไป งานโปรเจค งานไม่จัดหมวด
 *    ให้แยกกันชัดเจน · ไม่รก ดูง่าย รวมถึงหน้ามือถือ"
 *   แยกเป็น 3 ชั้นที่ไม่ปนกัน (อ่านจากบนลงล่าง ใหญ่ → เล็ก):
 *     1) หน้า     : กำลังดำเนินการ | ปิดแล้ว · ประวัติ    (มีเมนูข้างกำกับตรงกัน — /contracts กับ /contracts?view=closed)
 *     2) หมวดงาน  : งานสัญญา · งานทั่วไป · งานโปรเจค · ยังไม่จัดหมวด · ทั้งหมด
 *     3) สถานะย่อย : หน้าแรก = ทั้งหมด / เลยกำหนด · หน้าปิดแล้ว = หมดอายุ·รอต่อสัญญา / เข้างานครบแล้ว
 *   ตัวเลขบนแถบหมวด นับตามหน้า+สถานะที่เลือก · ตัวเลขบนสถานะ นับตามหมวดที่เลือก — อ่านตรงกันเสมอ
 */
import { Box, Stack, Typography, ButtonBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Description, Build, Engineering, HourglassEmpty, Apps, PlayCircleOutline, Inventory2, EventBusy } from "@mui/icons-material";

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const BLUE = "#2563eb";

export const CATEGORY_META = {
  contracts: { label: "งานสัญญา", unit: "สัญญา", icon: <Description />, color: "#4f46e5" },
  general: { label: "งานทั่วไป", unit: "งาน", icon: <Build />, color: "#059669" },
  project: { label: "งานโปรเจค", unit: "งาน", icon: <Engineering />, color: "#2563eb" },
  ungrouped: { label: "ยังไม่จัดหมวด", unit: "งาน", icon: <HourglassEmpty />, color: "#d97706" },
  all: { label: "ทั้งหมด", unit: "งาน", icon: <Apps />, color: "#475569" },
};
export const STAGE_META = {
  open: { label: "ทั้งหมด", color: BLUE },
  overdue: { label: "เลยกำหนดเข้ารอบ", short: "เลยกำหนด", color: "#dc2626" },
  expired: { label: "หมดอายุ · รอต่อสัญญา", short: "หมดอายุ", color: "#ea580c" },
  completed: { label: "เข้าครบ · ประวัติ", short: "เข้าครบ", color: "#16a34a" },
};
export const isContractish = (category) => category === "contracts" || category === "all";

/** สถานะย่อยที่เลือกได้ของแต่ละหน้า — "เลยกำหนด/หมดอายุ" มีความหมายเฉพาะงานสัญญา */
export const stagesFor = (scope, category) => (scope === "closed"
  ? [...(isContractish(category) ? ["expired"] : []), "completed"]
  : ["open", ...(isContractish(category) ? ["overdue"] : [])]);

export default function ContractNav({ scope, category, stage, onScope, onCategory, onStage, counts, showUngrouped = true, isMobile = false, yearText = "" }) {
  const cats = ["contracts", "general", "project", ...(showUngrouped ? ["ungrouped"] : []), "all"];
  const stages = stagesFor(scope, category);
  const closed = scope === "closed";

  /**
   * 🔁 (24 ต.ค. 2569 ผู้ใช้: "ชื่อหัวข้อให้ชัดเจน ไม่กำกวม หรือแยกออกมาให้ชัด ไม่งง")
   *    เดิม "ปิดแล้ว · ประวัติ" รวม 2 เรื่องที่ต่างกันมาก — สัญญาหมดอายุที่ "ยังต้องตามต่อสัญญา" กับงานที่จบไปแล้วจริง
   *    → แยกเป็น 3 ปุ่มระดับเดียวกัน: กำลังดำเนินการ · หมดอายุ รอต่อสัญญา (ต้องทำ) · จบแล้ว (ประวัติ)
   */
  const scopes = [
    { k: "active", label: "กำลังดำเนินการ", icon: <PlayCircleOutline />, n: counts.scope.active, on: !closed, color: BLUE, go: () => onScope("active") },
    ...(isContractish(category) || (counts.scope.expired ?? 0) > 0 ? [{
      k: "expired", label: "หมดอายุ · รอต่อสัญญา", short: "รอต่อสัญญา", icon: <EventBusy />, n: counts.scope.expired ?? 0, on: closed && stage === "expired", color: "#ea580c",
      go: () => { onScope("closed"); onStage("expired"); },
    }] : []),
    // 🔁 (26 ต.ค. 2569 ผู้ใช้: "แถบจบแล้ว อธิบายให้ชัดเจน และทำให้ไม่สับสน มันคืองานปีไหน และอะไรจบ")
    //    "จบแล้ว · ประวัติ" → "เข้าครบ · ประวัติ" (ผู้ใช้เลือกชื่อ) + แถบล่างบอกปีที่แสดง และแยกจำนวนตามเหตุที่เสร็จ (ทุกจอ รวมมือถือ)
    { k: "done", label: "เข้าครบ · ประวัติ", short: "เข้าครบ", icon: <Inventory2 />, n: counts.scope.completed ?? counts.scope.closed, on: closed && stage !== "expired", color: "#16a34a",
      go: () => { onScope("closed"); onStage("completed"); } },
  ];

  /**
   * ✅ (9 ต.ค. 2569 ผู้ใช้: "จุดนี้ยังดูรก ไม่ลงตัว ดูยาก") รวม 3 แถวที่ลอยแยกกันเป็น "การ์ดเดียว"
   *   หัวการ์ด: แท็บหมวดงาน (ซ้าย) · สวิตช์ กำลังดำเนินการ / ปิดแล้ว (ขวา) — มือถือสวิตช์อยู่บนแท็บ
   *   แถบล่าง (พื้นเทาอ่อน): สถานะย่อย + คำอธิบายสั้น — โผล่เฉพาะตอนมีให้เลือก
   */
  const scopeSwitch = (
    <Stack direction="row" sx={{ p: "3px", borderRadius: "10px", bgcolor: "#f1f5f9", flexShrink: 0, width: { xs: "100%", md: "auto" } }}>
      {scopes.map((o) => {
        const on = o.on;
        return (
          <ButtonBase key={o.k} onClick={() => !on && o.go()} aria-pressed={on} title={o.label}
            sx={{
              flex: { xs: 1, md: "initial" }, gap: 0.6, px: 1.25, height: 32, borderRadius: "8px", whiteSpace: "nowrap",
              fontSize: "0.8rem", fontWeight: 800,
              color: on ? INK : MUTED, bgcolor: on ? "#fff" : "transparent", boxShadow: on ? "0 1px 2px rgba(15,23,42,.14)" : "none",
              "& svg": { fontSize: 16, color: on ? o.color : "#94a3b8" },
            }}>
            {o.icon}
            {isMobile && o.short ? o.short : o.label}
            <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 800, color: on ? "#475569" : "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
              {o.n.toLocaleString()}
            </Box>
          </ButtonBase>
        );
      })}
    </Stack>
  );
  // หน้า "จบแล้ว"/"รอต่อสัญญา" เลือกจากปุ่มด้านบนแล้ว — แถบล่างเหลือแค่คำอธิบาย
  const showStageRow = (!closed && stages.length > 1) || closed;

  return (
    <Box sx={{ mb: { xs: 1.5, sm: 2 }, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
      {isMobile && <Box sx={{ px: 1, pt: 1 }}>{scopeSwitch}</Box>}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 0.5, md: 1.25 }, borderBottom: showStageRow ? `1px solid ${LINE}` : 0 }}>
        {/* หมวดงาน */}
        <Stack direction="row" sx={{ flex: 1, minWidth: 0, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          {cats.map((k) => {
            const m = CATEGORY_META[k];
            const on = category === k;
            return (
              <ButtonBase key={k} onClick={() => onCategory(k)} aria-pressed={on}
                sx={{
                  flexShrink: 0, gap: 0.6, px: { xs: 1, sm: 1.25 }, py: 1.4, position: "relative",
                  fontSize: { xs: "0.82rem", sm: "0.86rem" }, fontWeight: on ? 800 : 700, color: on ? INK : MUTED,
                  "& svg": { fontSize: 17, color: on ? m.color : "#94a3b8" },
                  "&::after": { content: '""', position: "absolute", left: 8, right: 8, bottom: 0, height: 3, borderRadius: "3px 3px 0 0", bgcolor: on ? m.color : "transparent" },
                  "&:hover": { color: INK },
                }}>
                {!isMobile && m.icon}
                {m.label}
                <Box component="span" sx={{ minWidth: 20, height: 18, px: 0.6, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, bgcolor: on ? alpha(m.color, 0.1) : "#f1f5f9", color: on ? m.color : "#94a3b8" }}>
                  {(counts.byCat[k] ?? 0).toLocaleString()}
                </Box>
              </ButtonBase>
            );
          })}
        </Stack>
        {!isMobile && scopeSwitch}
      </Stack>

      {/* สถานะย่อย + คำอธิบาย */}
      {showStageRow && (
        <Stack direction="row" alignItems="center" spacing={0.75} useFlexGap
          sx={{ px: { xs: 1, md: 1.5 }, py: 0.9, bgcolor: "#f8fafc", flexWrap: "wrap", rowGap: 0.75 }}>
          {!closed && stages.length > 1 && stages.map((k) => {
            const m = STAGE_META[k];
            const on = stage === k;
            return (
              <ButtonBase key={k} onClick={() => onStage(k)} aria-pressed={on}
                sx={{
                  gap: 0.6, height: 28, px: 1.1, borderRadius: 99, fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap",
                  border: `1px solid ${on ? alpha(m.color, 0.5) : LINE}`, bgcolor: on ? alpha(m.color, 0.08) : "#fff", color: on ? m.color : "#475569",
                  "&:hover": { borderColor: m.color },
                }}>
                {k !== "open" && <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: m.color }} />}
                {isMobile && m.short ? m.short : m.label}
                <Box component="span" sx={{ fontVariantNumeric: "tabular-nums", color: on ? m.color : MUTED }}>{(counts.byStage[k] ?? 0).toLocaleString()}</Box>
              </ButtonBase>
            );
          })}
          {closed && stage === "expired" && !isMobile && (
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
              สัญญาที่เลยวันสิ้นสุดแล้วแต่ยังไม่ได้ต่อ — ต้องติดตามลูกค้า · กด “ต่อสัญญาปีถัดไป” เพื่อสร้างสัญญาใหม่จากข้อมูลเดิม
            </Typography>
          )}
          {closed && stage !== "expired" && (() => {
            const d = counts.done || {};
            const parts = [
              d.rounds ? { n: d.rounds, t: "สัญญาที่เข้างานครบทุกครั้งตามสัญญา" } : null,
              d.renewed ? { n: d.renewed, t: "สัญญาที่หมดอายุและต่อฉบับใหม่แล้ว" } : null,
              d.jobs ? { n: d.jobs, t: "งานทั่วไป/โปรเจคที่ปิดงานครบทุกวัน" } : null,
            ].filter(Boolean);
            return (
              <Box sx={{ width: "100%" }}>
                <Typography sx={{ fontSize: "0.78rem", color: INK, fontWeight: 800 }}>
                  งานที่ไม่ต้องทำอะไรต่อแล้ว · แสดง{yearText ? ` ${yearText}` : "ทุกปี"}
                  <Box component="span" sx={{ fontWeight: 600, color: MUTED }}> (เปลี่ยนปีได้ที่ตัวกรอง)</Box>
                </Typography>
                {parts.length > 0 && (
                  <Stack direction="row" useFlexGap flexWrap="wrap" columnGap={1.5} rowGap={0.25} sx={{ mt: 0.25 }}>
                    {parts.map((x) => (
                      <Typography key={x.t} sx={{ fontSize: "0.76rem", color: MUTED }}>
                        <Box component="span" sx={{ color: "#16a34a", fontWeight: 800 }}>✓ {x.n.toLocaleString()}</Box> {x.t}
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Box>
            );
          })()}
        </Stack>
      )}
    </Box>
  );
}
