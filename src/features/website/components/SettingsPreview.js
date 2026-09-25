import { Box, Chip, Link, Stack, Typography } from "@mui/material";
import {
  CheckCircleOutline, EmailOutlined, LocationOnOutlined, OpenInNew, PhoneInTalkOutlined, PhoneOutlined, PlaceOutlined, VisibilityOffOutlined,
} from "@mui/icons-material";

import { WEBSITE_URL } from "../services/WebsiteService";
import { UI } from "./WebsiteUi";

/**
 * ตัวช่วยของหน้า "การแสดงผลเว็บไซต์" — บอกว่าแต่ละค่าไปโผล่หน้าไหน + ตัวอย่างหน้าตาก่อนกดบันทึก
 *
 * ✅ ผู้ใช้สั่ง (25 ก.ย. 2569): "อธิบายหน้าการตั้งค่าทั้งหมดว่าทำอะไร เปลี่ยนแปลงหน้าไหน ถ้ามี preview ก่อนบันทึกยิ่งดี"
 * ⚠️ ตัวอย่างวาดด้วย MUI เลียนแบบหน้าตาบนเว็บ (สี ขนาด ลำดับ) — ไม่ใช่ iframe ของเว็บจริง
 *    เพราะเว็บจริงยังเป็นค่าที่ "บันทึกแล้ว" จะเห็นค่าใหม่ได้ก็ต่อเมื่อกดบันทึก ซึ่งขัดกับจุดประสงค์ของตัวอย่าง
 *    ถ้าแก้หน้าตาบนเว็บ (da-web) ส่วนไหน ให้ปรับตัวอย่างที่นี่ตามด้วย
 */

/** รูปประกอบบริการที่ติดมากับเว็บ — ⚠️ ถ้ายังไม่ตั้ง REACT_APP_WEBSITE_URL ใช้โดเมน Vercel เดิมไปก่อน */
export const ART_BASE = WEBSITE_URL || "https://doall.vercel.app";

const RED = "#dc2626";
const NAVY = "#0f172a";

/** "แสดงที่:" + ลิงก์เปิดหน้านั้นบนเว็บ (ถ้าตั้ง REACT_APP_WEBSITE_URL) */
export function WhereShown({ items }) {
  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: UI.sub, display: "inline-flex", alignItems: "center", gap: 0.4 }}>
        <PlaceOutlined sx={{ fontSize: 16 }} /> แสดงที่
      </Typography>
      {items.map(({ label, path }) =>
        WEBSITE_URL && path !== undefined ? (
          <Chip key={label} size="small" label={label} component="a" href={`${WEBSITE_URL}${path}`} target="_blank" rel="noopener noreferrer" clickable
            icon={<OpenInNew sx={{ fontSize: "14px !important" }} />} variant="outlined" sx={{ fontWeight: 600 }} />
        ) : (
          <Chip key={label} size="small" label={label} variant="outlined" sx={{ fontWeight: 600 }} />
        ),
      )}
    </Stack>
  );
}

/** กรอบ "ตัวอย่าง" — ทุกตัวอย่างใช้กรอบเดียวกัน ผู้ใช้แยกออกทันทีว่าส่วนนี้ดูอย่างเดียว แก้ไม่ได้ */
export function PreviewFrame({ title = "ตัวอย่างบนเว็บ (ก่อนบันทึก)", children, dark = false }) {
  return (
    <Box sx={{ mt: 2, border: `1px dashed ${UI.border}`, borderRadius: 2, overflow: "hidden" }}>
      <Typography sx={{ px: 1.5, py: 0.75, fontSize: "0.72rem", fontWeight: 800, letterSpacing: 0.3, color: UI.sub, bgcolor: "#f8fafc", borderBottom: `1px dashed ${UI.border}` }}>
        👁 {title}
      </Typography>
      <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: dark ? NAVY : "#fff" }}>{children}</Box>
    </Box>
  );
}

/* ── หน้าแรก: ลำดับส่วนต่างๆ และส่วนไหนเปิด/ปิด ───────────────────────────── */
export function HomeOutlinePreview({ s }) {
  const rows = [
    { label: "ส่วนหัว (ข้อความหลัก · ปุ่มขอใบเสนอราคา)", on: true, fixed: true },
    { label: "ตัวเลขของบริษัท", on: s.showStats && (s.stats || []).length > 0, key: "showStats" },
    { label: "บริการของเรา (การ์ดพร้อมรูป)", on: true, fixed: true },
    { label: "ทำไมต้องเลือกเรา", on: true, fixed: true },
    { label: "ผลงานล่าสุด", on: s.showProjects, key: "showProjects", note: "ซ่อนเองถ้ายังไม่มีผลงานที่เผยแพร่" },
    { label: "แบรนด์อุปกรณ์ที่เราเลือกใช้", on: s.showBrands, key: "showBrands" },
    { label: "แถบชวนติดต่อท้ายหน้า", on: true, fixed: true },
  ];
  return (
    <PreviewFrame title="ตัวอย่างลำดับส่วนต่างๆ บนหน้าแรก">
      <Stack spacing={0.75} sx={{ maxWidth: 460 }}>
        <Box sx={{ px: 1.25, py: 0.75, bgcolor: NAVY, color: "#fff", borderRadius: 1, fontSize: "0.75rem", display: "flex", justifyContent: "space-between", gap: 1 }}>
          <span>เมนู: หน้าแรก · เกี่ยวกับเรา · บริการ · สินค้า · ผลงาน{s.showArticles ? " · บทความ" : ""}</span>
          {!s.showArticles && <span style={{ opacity: 0.7 }}>(ไม่มีบทความ)</span>}
        </Box>
        {rows.map((r) => (
          <Stack key={r.label} direction="row" alignItems="center" spacing={1}
            sx={{ px: 1.25, py: 0.9, borderRadius: 1, border: `1px solid ${r.on ? "#fecaca" : UI.border}`, bgcolor: r.on ? "#fef2f2" : "#f8fafc", opacity: r.on ? 1 : 0.6 }}>
            {r.on ? <CheckCircleOutline sx={{ fontSize: 17, color: RED }} /> : <VisibilityOffOutlined sx={{ fontSize: 17, color: UI.sub }} />}
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, flex: 1, textDecoration: r.on ? "none" : "line-through" }}>{r.label}</Typography>
            <Typography sx={{ fontSize: "0.7rem", color: UI.sub }}>{r.fixed ? "แสดงเสมอ" : r.on ? (r.note || "แสดง") : "ซ่อน"}</Typography>
          </Stack>
        ))}
      </Stack>
    </PreviewFrame>
  );
}

/* ── ตัวเลขของบริษัท — หน้าตาเหมือนแถบตัวเลขใต้ส่วนหัวของหน้าแรก ──────────────── */
export function StatsPreview({ stats, show }) {
  const list = (stats || []).filter((st) => String(st.label).trim());
  return (
    <PreviewFrame title={show ? "ตัวอย่างแถบตัวเลข (หน้าแรก)" : "ตัวอย่างแถบตัวเลข — ตอนนี้ปิดอยู่ จะไม่แสดงบนเว็บ"}>
      {list.length === 0 ? (
        <Typography sx={{ color: UI.sub, fontSize: "0.85rem" }}>ไม่มีตัวเลข — แถบนี้จะไม่แสดงบนหน้าแรก</Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: `repeat(${Math.min(list.length, 4)}, minmax(0,1fr))` }, bgcolor: "#f8fafc", p: 2, borderRadius: 1.5, opacity: show ? 1 : 0.5 }}>
          {list.map((st, i) => (
            <Box key={i}>
              <Typography sx={{ fontSize: { xs: "1.6rem", sm: "2rem" }, fontWeight: 800, color: NAVY, lineHeight: 1.1 }}>
                {Number(st.value) || 0}<span style={{ color: RED }}>{st.suffix}</span>
              </Typography>
              <Typography sx={{ mt: 0.75, fontSize: "0.85rem", fontWeight: 700, color: NAVY }}>{st.label}</Typography>
              {st.note && <Typography sx={{ mt: 0.25, fontSize: "0.72rem", color: "#64748b", lineHeight: 1.5 }}>{st.note}</Typography>}
            </Box>
          ))}
        </Box>
      )}
    </PreviewFrame>
  );
}

/* ── ประกาศแถบบนสุด + เวลาทำการ (หน้าติดต่อเรา · ท้ายเว็บ) ────────────────────── */
export function HoursPreview({ s }) {
  return (
    <PreviewFrame title="ตัวอย่างประกาศแถบบนสุด · กล่องเวลาทำการหน้าติดต่อเรา · ท้ายเว็บ">
      <Stack spacing={2}>
        <Box sx={{ border: `1px solid ${UI.border}`, borderRadius: 1.5, overflow: "hidden" }}>
          {s.announcement ? (
            <Box sx={{ bgcolor: NAVY, color: "#fff", textAlign: "center", fontSize: "0.8rem", py: 0.75, px: 1 }}>{s.announcement}</Box>
          ) : (
            <Box sx={{ textAlign: "center", fontSize: "0.72rem", color: UI.sub, py: 0.5, bgcolor: "#f8fafc" }}>(ไม่มีประกาศ — แถบนี้ไม่แสดง)</Box>
          )}
          <Box sx={{ px: 1.5, py: 1, fontSize: "0.75rem", color: UI.sub, borderTop: `1px solid ${UI.border}` }}>แถบเมนูของเว็บ …</Box>
        </Box>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <Box sx={{ border: `1px solid ${UI.border}`, borderRadius: 1.5, p: 1.5 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: UI.sub, mb: 0.75 }}>หน้าติดต่อเรา · เวลาทำการ</Typography>
            <Typography sx={{ fontSize: "0.85rem", color: NAVY }}>{s.businessHoursWeekdays}</Typography>
            <Typography sx={{ fontSize: "0.85rem", color: NAVY }}>{s.businessHoursSaturday}</Typography>
            <Typography sx={{ fontSize: "0.85rem", color: "#64748b" }}>ปิด{s.businessHoursClosed}</Typography>
            {s.emergencyNote && (
              <Box sx={{ mt: 1.25, p: 1, bgcolor: "#fef2f2", borderRadius: 1, fontSize: "0.78rem", color: "#7f1d1d" }}>{s.emergencyNote}</Box>
            )}
          </Box>
          <Box sx={{ bgcolor: NAVY, borderRadius: 1.5, p: 1.5 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#94a3b8", mb: 0.75 }}>ท้ายเว็บ (ทุกหน้า)</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#e2e8f0" }}>{s.businessHoursWeekdays}</Typography>
            {s.businessHoursSaturday && <Typography sx={{ fontSize: "0.82rem", color: "#e2e8f0" }}>{s.businessHoursSaturday}</Typography>}
            {s.businessHoursClosed && <Typography sx={{ fontSize: "0.82rem", color: "#94a3b8" }}>ปิด{s.businessHoursClosed}</Typography>}
          </Box>
        </Box>
      </Stack>
    </PreviewFrame>
  );
}

/* ── พื้นที่ให้บริการ (หน้าเกี่ยวกับเรา) ───────────────────────────────────── */
export function AreasPreview({ areas }) {
  const list = (areas || []).map((a) => String(a).trim()).filter(Boolean);
  return (
    <PreviewFrame title="ตัวอย่างหน้าเกี่ยวกับเรา · ส่วนพื้นที่ให้บริการ">
      {list.length === 0 ? (
        <Typography sx={{ color: UI.sub, fontSize: "0.85rem" }}>ยังไม่มีพื้นที่ — ส่วนรายชื่อจะว่าง</Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(3, minmax(0,1fr))" } }}>
          {list.map((a) => (
            <Stack key={a} direction="row" alignItems="center" spacing={0.75} sx={{ border: `1px solid ${UI.border}`, borderRadius: 1.5, px: 1.25, py: 1 }}>
              <LocationOnOutlined sx={{ fontSize: 16, color: RED }} />
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600 }} noWrap>{a}</Typography>
            </Stack>
          ))}
        </Box>
      )}
    </PreviewFrame>
  );
}

/* ── การ์ดบริการ (หน้าแรก · หน้ารวมบริการ) ─────────────────────────────────── */
export function ServiceCardPreview({ slug, label, image }) {
  const src = image?.url || `${ART_BASE}/services/${slug}.svg`;
  return (
    <Box sx={{ border: `1px solid ${UI.border}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff", maxWidth: 320 }}>
      <Box sx={{ aspectRatio: "16 / 10", bgcolor: "#f1f5f9" }}>
        <Box component="img" src={src} alt="" loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </Box>
      <Box sx={{ p: 1.25 }}>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.7rem", color: image?.url ? "#15803d" : UI.sub, mt: 0.25 }}>
          {image?.url ? "ใช้รูปที่อัป" : "ใช้ภาพประกอบที่ติดมากับเว็บ"}
        </Typography>
        <Link component="span" underline="none" sx={{ display: "block", mt: 0.5, fontSize: "0.72rem", fontWeight: 700, color: RED }}>ดูรายละเอียด →</Link>
      </Box>
    </Box>
  );
}

/* ── ยี่ห้อ (หน้าแรก · กล่องแบรนด์ในหน้าบริการ) ───────────────────────────── */
/** โลโก้ที่ติดมากับเว็บ (da-web/public/brands) — ⚠️ ต้องตรงกับ LOGOS ใน da-web/src/data/brands.ts */
const BUILTIN_LOGOS = ["notifier", "edwards", "hochiki", "asenware", "gst", "hikvision", "dahua", "hip", "zkteco"];
const logoSrc = (b) => b.logo?.url || (BUILTIN_LOGOS.includes(b.name.trim().toLowerCase()) ? `${ART_BASE}/brands/${b.name.trim().toLowerCase()}.png` : "");

export function BrandsPreview({ brands }) {
  const shown = (brands || []).filter((b) => b.status === "published");
  const groups = [];
  shown.forEach((b) => {
    const g = groups.find((x) => x.category === b.category);
    if (g) g.items.push(b); else groups.push({ category: b.category, items: [b] });
  });
  const Mark = ({ b, big }) => (
    <Box sx={{ height: big ? 64 : 44, border: `1px solid ${UI.border}`, borderRadius: 1.5, display: "grid", placeItems: "center", px: 1, bgcolor: "#fff" }}>
      {logoSrc(b)
        ? <Box component="img" src={logoSrc(b)} alt={b.name} sx={{ maxHeight: big ? 36 : 24, maxWidth: "100%", objectFit: "contain" }} />
        : <Typography sx={{ fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", fontSize: big ? "0.95rem" : "0.75rem", color: "#475569" }} noWrap>{b.name}</Typography>}
    </Box>
  );
  return (
    <PreviewFrame title="ตัวอย่างส่วนแบรนด์บนหน้าแรก (ยี่ห้อที่ซ่อนอยู่ไม่แสดง)">
      {groups.length === 0 ? (
        <Typography sx={{ color: UI.sub, fontSize: "0.85rem" }}>ไม่มียี่ห้อที่แสดง — ส่วนนี้จะไม่แสดงบนหน้าแรก</Typography>
      ) : (
        <Stack spacing={1.5}>
          {groups.map((g) => {
            const main = g.items.filter((b) => b.featured);
            const rest = g.items.filter((b) => !b.featured);
            return (
              <Box key={g.category} sx={{ border: `1px solid ${UI.border}`, borderRadius: 1.5, overflow: "hidden" }}>
                <Box sx={{ px: 1.25, py: 0.75, bgcolor: main.length ? NAVY : "#f8fafc", color: main.length ? "#fff" : NAVY, fontWeight: 800, fontSize: "0.8rem" }}>{g.category}</Box>
                <Box sx={{ p: 1.25 }}>
                  {main.length > 0 && (
                    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, mb: rest.length ? 1.25 : 0 }}>
                      {main.map((b) => <Mark key={b._id} b={b} big />)}
                    </Box>
                  )}
                  {rest.length > 0 && (
                    <>
                      {main.length > 0 && <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: UI.sub, mb: 0.75 }}>แบรนด์ชั้นนำอื่น ๆ</Typography>}
                      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                        {rest.map((b) => <Mark key={b._id} b={b} />)}
                      </Box>
                    </>
                  )}
                </Box>
              </Box>
            );
          })}
          <Typography sx={{ fontSize: "0.72rem", color: UI.sub }}>
            ยี่ห้อที่ไม่ได้อัปโลโก้ ใช้โลโก้ที่ติดมากับเว็บ · ยี่ห้อที่ไม่มีทั้งสองอย่างแสดงเป็นชื่อ · ⭐ แบรนด์หลักแสดงเป็นกล่องใหญ่แถวบน
          </Typography>
        </Stack>
      )}
    </PreviewFrame>
  );
}

/* ── ช่องทางติดต่อของเว็บ — ท้ายเว็บ · หน้าติดต่อเรา · ปุ่มลอย ─────────────────── */
const LINE_D = "M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314";
const FB_D = "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z";
const BrandSvg = ({ d, color }) => (
  <Box component="svg" viewBox="0 0 24 24" sx={{ width: 18, height: 18, flexShrink: 0 }}><path d={d} fill={color} /></Box>
);

/** ช่องทางที่จะแสดงบนเว็บ ตามลำดับจริงบนเว็บ (ช่องว่าง = ไม่แสดง) */
export const webChannels = (s) => [
  s.contactHotline && { key: "hotline", label: "สายด่วน (Hotline)", value: s.contactHotline, icon: <PhoneInTalkOutlined sx={{ fontSize: 18, color: RED }} /> },
  s.contactTel && { key: "tel", label: "โทรศัพท์", value: s.contactTel, icon: <PhoneOutlined sx={{ fontSize: 18, color: "#64748b" }} /> },
  s.contactEmail && { key: "email", label: "อีเมล", value: s.contactEmail, icon: <EmailOutlined sx={{ fontSize: 18, color: "#64748b" }} /> },
  s.contactLine && { key: "line", label: "LINE", value: "แชทผ่าน LINE", icon: <BrandSvg d={LINE_D} color="#06C755" /> },
  s.contactFacebook && { key: "facebook", label: "Facebook", value: "Facebook Page", icon: <BrandSvg d={FB_D} color="#0866FF" /> },
].filter(Boolean);

export function ContactPreview({ s }) {
  const list = webChannels(s);
  return (
    <PreviewFrame title="ตัวอย่างช่องทางติดต่อบนเว็บ (ท้ายเว็บ · หน้าติดต่อเรา · ปุ่มลอยมุมขวาล่าง)">
      {list.length === 0 ? (
        <Typography sx={{ color: UI.sub, fontSize: "0.85rem" }}>ยังไม่มีช่องทางติดต่อ — ท้ายเว็บและหน้าติดต่อเราจะไม่มีเบอร์/ลิงก์ และไม่มีปุ่มลอย</Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <Box sx={{ bgcolor: NAVY, borderRadius: 1.5, p: 1.5 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#94a3b8", mb: 1 }}>ท้ายเว็บ (ทุกหน้า)</Typography>
            <Stack spacing={1}>
              {list.map((c) => (
                <Stack key={c.key} direction="row" spacing={1} alignItems="center">
                  {c.icon}
                  <Typography sx={{ fontSize: "0.82rem", color: "#cbd5e1" }}>
                    {c.key === "hotline" ? <>สายด่วน <b style={{ color: "#fff" }}>{c.value}</b></> : c.value}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
          <Box sx={{ border: `1px solid ${UI.border}`, borderRadius: 1.5, p: 1.5 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: UI.sub, mb: 1 }}>หน้าติดต่อเรา</Typography>
            <Stack spacing={1.25}>
              {list.map((c) => (
                <Stack key={c.key} direction="row" spacing={1.25} alignItems="flex-start">
                  <Box sx={{ mt: 0.25 }}>{c.icon}</Box>
                  <Box>
                    <Typography sx={{ fontSize: "0.7rem", color: UI.sub }}>{c.label}</Typography>
                    <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: NAVY, wordBreak: "break-all" }}>{c.value}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Box>
      )}
    </PreviewFrame>
  );
}
