/**
 * JobTypeChip / JobOptionRow — ป้ายประเภทงาน (PM · Service · PO · Inspection ฯลฯ) แยกสีให้มองง่าย
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "อยากให้มีการไฮไลต์ แยกสีประเภทงาน PM SERVICE ต่างๆ ให้มองง่าย และสวยงาม
 *    ทุกๆ หน้า ทุกเมนู ที่มีการผูกงานแบบนี้ ให้สมบูรณ์")
 *    ใช้ในช่องเลือกงาน (ใบ Advance/เคลม · ค่าจ้างผู้รับเหมา · OT · ใบขอซื้อ) และจุดที่แสดงงานที่ผูกไว้
 *    สี: ใช้สีงานจริงบนปฏิทิน (backgroundColor) ถ้ามี — ไม่มีก็ใช้สีประจำประเภทชุดเดียวกันทุกหน้า
 */
import { Box, Stack, Typography } from "@mui/material";

const TYPE_COLORS = [
  [/^pm\b|preventive/i, "#4f46e5"],
  [/^service|^svc|บริการ|ซ่อม/i, "#0891b2"],
  [/^po\b|purchase|สั่งซื้อ/i, "#16a34a"],
  [/inspection|ตรวจสอบ|ตรวจเช็ค/i, "#d97706"],
  [/สำรวจ|survey/i, "#0284c7"],
  [/ติดตั้ง|install/i, "#7c3aed"],
  [/เปลี่ยน|replace/i, "#ea580c"],
  [/คุยงาน|ประชุม|meeting/i, "#475569"],
  [/ส่งของ|ส่งมอบ|deliver/i, "#0d9488"],
];
const FALLBACK = ["#db2777", "#65a30d", "#9333ea", "#0369a1", "#b45309", "#be123c"];

const hash = (s) => [...String(s)].reduce((h, c) => ((h * 31) + c.charCodeAt(0)) >>> 0, 7);

/** สีพื้น/สีตัวอักษรของประเภทงาน */
export const jobTypeColor = (job) => {
  const title = String(job?.title || job || "").trim();
  if (job?.backgroundColor && /^#|^rgb/i.test(job.backgroundColor)) {
    return { bg: job.backgroundColor, fg: job.textColor || "#fff" };
  }
  const hit = TYPE_COLORS.find(([re]) => re.test(title));
  return { bg: hit ? hit[1] : FALLBACK[hash(title.toLowerCase()) % FALLBACK.length], fg: "#fff" };
};

/** ป้ายประเภทงาน (ชื่อประเภท = job.title) */
export default function JobTypeChip({ job, title, size = "small", sx }) {
  const t = String(title ?? job?.title ?? "").trim();
  if (!t) return null;
  const { bg, fg } = jobTypeColor(job?.title ? job : t);
  const sm = size === "small";
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", flexShrink: 0, maxWidth: "100%",
      height: sm ? 20 : 24, px: sm ? 0.75 : 1, borderRadius: 1, bgcolor: bg, color: fg,
      fontSize: sm ? "0.7rem" : "0.78rem", fontWeight: 800, letterSpacing: 0.2, lineHeight: 1,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...sx,
    }}>
      {t}
    </Box>
  );
}

/**
 * แถวงานในช่องเลือกงาน: [ป้ายประเภท] ระบบ · โครงการ · ครั้งที่ + บรรทัดรองเล็ก
 * @param main  ข้อความหลัก (ไม่ต้องมีชื่อประเภทซ้ำ — ตัดออกให้อัตโนมัติถ้าขึ้นต้นด้วยชื่อประเภท)
 */
export function JobOptionRow({ job, main, sub, extra }) {
  const t = String(job?.title || "").trim();
  const rest = String(main || "").trim();
  const text = t && rest.toLowerCase().startsWith(t.toLowerCase()) ? rest.slice(t.length).trim() : rest;
  return (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.25 }}>
        <JobTypeChip job={job} />
        <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: 700, lineHeight: 1.35, minWidth: 0 }}>{text || (t ? "" : "งาน")}</Typography>
        {extra}
      </Stack>
      {sub && <Typography variant="caption" sx={{ color: "#64748b", display: "block", lineHeight: 1.4 }} component="div">{sub}</Typography>}
    </Box>
  );
}
