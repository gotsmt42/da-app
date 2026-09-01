/**
 * SiteMapLink — "ตำแหน่งหน้างานบน Google Maps" ของโครงการหนึ่ง ใช้ซ้ำได้ทุกหน้าที่มีงาน
 *
 * ✅ ที่มา (ผู้ใช้ขอ: "ทำแบบเดียวกันที่มีงานของทุกหน้า ให้ดู หรือแก้ไข google maps ได้ แยกตาม
 * สิทธิเดิม"): เดิมพิกัดหน้างานมีเฉพาะในระบบใบแจ้งงาน (Dispatch) — หน้าที่คนใช้จริงทุกวันอย่าง
 * ปฏิทิน/การดำเนินงาน/ภาพรวมงาน ไม่มีเลย ช่างที่เปิดงานจากหน้าพวกนั้นจึงยังต้องโทรถามอยู่ดี
 *
 * ⚠️ **แหล่งข้อมูลเดียวคือทะเบียนลูกค้า** (Customer.mapUrl ผูกกับ cCompany + cSite) ไม่ใช่เก็บ
 * รายงาน — โครงการเดิมอยู่ที่เดิมเสมอ ถ้าเก็บรายงานจะต้องกรอกซ้ำทุกครั้งที่ลงงานใหม่ และงานเก่า/
 * ใหม่ของที่เดียวกันจะมีพิกัดไม่ตรงกันได้ · แก้ที่เดียว = ทุกงานของโครงการนั้นได้พิกัดพร้อมกัน
 *
 * ⚠️ ตัวนี้เป็นแค่ "หน้าจอ" — ด่านสิทธิ์จริงอยู่ที่ PATCH /api/customer/map ฝั่ง server เสมอ
 * (แอดมิน/ผู้จัดการ หรือช่างที่มีงานอยู่ที่โครงการนั้นจริง) prop canEdit มีไว้ซ่อนปุ่มที่กดไปก็ไม่ผ่าน
 *
 * ⚠️ คอมโพเนนต์หาพิกัดเองจากทะเบียนลูกค้า (แคชระดับโมดูล ยิงครั้งเดียวต่อการเปิดแอป) — ตั้งใจให้
 * ต่อเข้าหน้าไหนก็ได้โดยไม่ต้องไปแก้การโหลดข้อมูลของหน้านั้น ซึ่งหลายหน้าไม่ได้โหลดลูกค้าไว้อยู่แล้ว
 * (เช่น OperationBoard) การบังคับให้ทุกหน้าโหลดเพิ่มเองจะทำให้ต้องแก้หลายที่และลืมง่าย
 */
import { useEffect, useState } from "react";
import { Box, Stack, Button, IconButton, TextField, Tooltip, Typography, Popover } from "@mui/material";
import { OpenInNew, Edit } from "@mui/icons-material";

import CustomerService from "@/shared/services/CustomerService";

const SUB = "#64748b";
const BORDER = "#e2e8f0";

/* ══════════ หมุด Google Maps — ใช้ตัวเดียวกันทั้งแอป ══════════
 * ⚠️ เดิมแต่ละหน้าใช้ไอคอนคนละอย่าง: ฟอร์มแก้ไขงานใช้อีโมจิ 🗺️ (แผนที่กระดาษพับ — สื่อว่า "แผนที่"
 * เฉยๆ ไม่ได้บอกว่าเป็นบริการไหน) ส่วนหน้าที่เป็น React ใช้ไอคอนหมุดขาวดำของ MUI ที่กลืนไปกับไอคอน
 * อื่นในหน้าเดียวกัน คนกดจึงไม่รู้ว่ากดแล้วจะเด้งไป Google Maps
 * ✅ ใช้หมุดสีแดงของ Google (#EA4335) เหมือนกันทุกจุด + เขียนคำว่า "Google Maps" ในป้ายกำกับ —
 * สีบอกด้วยตา คำบอกด้วยข้อความ ไม่ต้องเดา
 * ⚠️ ต้องมี 2 รูปแบบ เพราะฟอร์มแก้ไข/เพิ่มงานเป็น HTML string ของ SweetAlert ใส่ JSX ไม่ได้
 */
const PIN_RED = "#EA4335";
const PIN_PATH =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z";

/** สำหรับฟอร์มที่เป็น HTML string (EditEvent/AddEvent ที่ใช้ SweetAlert) */
export const googleMapsPinSvg = (size = 15) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" ` +
  `style="vertical-align:-2px;flex-shrink:0;"><path fill="${PIN_RED}" d="${PIN_PATH}"/></svg>`;

/** สำหรับหน้าที่เป็น React — ใช้แทนไอคอนหมุดของ MUI ได้ตรงๆ (รับ sx ไม่ได้ จึงรับ size แทน) */
export const GoogleMapsPin = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <path fill={PIN_RED} d={PIN_PATH} />
  </svg>
);

/**
 * ลิงก์ค้นหาใน Google Maps — ไม่ต้องออกไปเปิดแอปแล้วพิมพ์ชื่อโครงการซ้ำเอง
 *
 * ⚠️ ที่แก้ (ผู้ใช้สั่ง: "การค้นหาให้อิงจากชื่อโครงการ"): เดิมต่อ "ชื่อโครงการ + ชื่อบริษัท" เข้าด้วยกัน
 * เป็นคำค้นเดียว — Google Maps ตีความเป็นสถานที่เดียวที่ต้องตรงทั้งสองส่วน พอชื่อบริษัทเป็นชื่อ
 * นิติบุคคล (เช่น "บริษัท ... จำกัด (มหาชน)") ซึ่งไม่ใช่ชื่อที่ปักหมุดอยู่บนแผนที่ มักค้นไม่เจอเลย
 * ทั้งที่ค้นด้วยชื่อโครงการอย่างเดียวเจอทันที — ใช้ชื่อโครงการเป็นหลัก ตกไปใช้ชื่อบริษัทเฉพาะตอนที่
 * งานนั้นไม่ได้กรอกชื่อโครงการไว้เลย
 */
export const mapSearchUrl = (site, company) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    String(site || "").trim() || String(company || "").trim()
  )}`;

// ── แคชทะเบียนลูกค้าระดับโมดูล ────────────────────────────────────────────
// ⚠️ ต้องมี inflight ด้วย ไม่ใช่แค่ cache — การ์ดหลายใบบนหน้าเดียวกัน mount พร้อมกัน ถ้าเช็คแค่
// cache จะยิง request พร้อมกันหลายเส้นก่อนที่เส้นแรกจะกลับมา
let cache = null;
let inflight = null;
const subs = new Set();

const keyOf = (company, site) => `${String(company || "").trim()}|||${String(site || "").trim()}`;

function buildIndex(list) {
  const m = new Map();
  for (const c of list || []) {
    m.set(keyOf(c.cCompany, c.cSite), c.mapUrl || "");
    // เผื่อกรณีงานไม่ได้กรอกบริษัทไว้ — ให้หาเจอด้วยชื่อโครงการอย่างเดียวได้
    if (c.cSite && !m.has(keyOf("", c.cSite))) m.set(keyOf("", c.cSite), c.mapUrl || "");
  }
  return m;
}

function useSiteMapIndex() {
  const [index, setIndex] = useState(cache);
  useEffect(() => {
    if (cache) return undefined;
    let alive = true;
    const onDone = (m) => { if (alive) setIndex(m); };
    subs.add(onDone);
    if (!inflight) {
      inflight = CustomerService.getCustomers()
        .then((d) => {
          cache = buildIndex(d?.userCustomers);
          subs.forEach((fn) => fn(cache));
          return cache;
        })
        .catch(() => {
          // โหลดทะเบียนไม่ได้ = โชว์ปุ่มค้นหาไปก่อน ดีกว่าทำให้ทั้งการ์ดพัง
          cache = new Map();
          subs.forEach((fn) => fn(cache));
          return cache;
        })
        .finally(() => { inflight = null; });
    }
    return () => { alive = false; subs.delete(onDone); };
  }, []);
  return index;
}

/** อัปเดตแคชหลังบันทึก — ไม่งั้นการ์ดใบอื่นของโครงการเดียวกันยังโชว์ค่าเก่าจนกว่าจะรีเฟรชหน้า */
function writeCache(company, site, mapUrl) {
  if (!cache) cache = new Map();
  cache.set(keyOf(company, site), mapUrl);
  cache.set(keyOf("", site), mapUrl);
  subs.forEach((fn) => fn(new Map(cache)));
}

/**
 * พิกัดที่บันทึกไว้ของโครงการหนึ่ง + ลิงก์ที่ควรเปิด — สำหรับหน้าที่ไม่อยากได้ปุ่มแยกของตัวเอง แต่อยาก
 * ให้ "ข้อความที่มีอยู่แล้ว" (เช่น ชื่อโครงการ) กดเปิดแผนที่ได้เลย
 *
 * ⚠️ ต้องใช้ตัวนี้เท่านั้น อย่าไปเรียก CustomerService เองในแต่ละหน้า — ทะเบียนลูกค้าถูกแคชไว้ระดับ
 * โมดูลพร้อมกันยิงซ้ำ (ดู useSiteMapIndex) หน้าที่มีการ์ดหลายสิบใบจึงโหลดครั้งเดียวจบ ถ้าแยกไปเรียกเอง
 * จะกลายเป็นยิงต่อการ์ด และค่าที่เพิ่งบันทึกจากที่อื่นจะไม่อัปเดตตามเพราะไม่ได้ subscribe แคชเดียวกัน
 *
 * @returns {{ url: string, href: string, saved: boolean }}
 *   url   = พิกัดที่บันทึกไว้ ("" ถ้ายังไม่มี)
 *   href  = ลิงก์ที่ควรเปิดจริง (มีพิกัด → พิกัดนั้น · ยังไม่มี → ค้นหาชื่อโครงการใน Google Maps)
 *   saved = มีพิกัดบันทึกไว้แล้วหรือยัง (ใช้เลือกข้อความ/ไอคอนว่า "นำทาง" หรือ "ค้นหา")
 */
export function useSiteMapUrl(company, site) {
  const index = useSiteMapIndex();
  const url = index?.get(keyOf(company, site)) ?? index?.get(keyOf("", site)) ?? "";
  return { url, href: url || mapSearchUrl(site, company), saved: !!url };
}

/**
 * @param {boolean} [compact] โหมดกะทัดรัดสำหรับ "ช่องในตาราง" — เหลือไอคอนหมุดอย่างเดียว และแก้ผ่าน
 *   popover แทนการกางช่องกรอกในเซลล์ (ตารางมีความกว้างจำกัด ถ้ากางในเซลล์จะดันคอลัมน์อื่นเสียทรง)
 */
export default function SiteMapLink({ company, site, canEdit = false, size = "small", compact = false, onSaved }) {
  const index = useSiteMapIndex();
  const [draft, setDraft] = useState(null); // null = ไม่ได้แก้อยู่
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [anchor, setAnchor] = useState(null);

  // ไม่มีทั้งชื่อโครงการและบริษัท = ไม่มีอะไรให้ค้นหา/ผูกพิกัด
  if (!site && !company) return null;

  const url = index?.get(keyOf(company, site)) ?? index?.get(keyOf("", site)) ?? "";

  const save = async () => {
    setSaving(true); setError("");
    try {
      const next = draft.trim();
      const customer = await CustomerService.setSiteMapUrl({ company, site, mapUrl: next });
      writeCache(company, site, customer?.mapUrl ?? next);
      setDraft(null);
      onSaved?.(customer);
    } catch (err) {
      setError(err?.response?.data?.message || "บันทึกพิกัดไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const editor = (
    <Box onClick={(e) => e.stopPropagation()} sx={compact ? { p: 1.5, width: 340 } : undefined}>
      <TextField
        size="small" fullWidth autoFocus value={draft ?? ""}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="วางลิงก์ที่แชร์จาก Google Maps"
        error={Boolean(error)}
        helperText={error || "กดค้นหาด้านล่าง → เจอตำแหน่งแล้วกด แชร์ → คัดลอกลิงก์ → วางที่นี่ · เว้นว่างเพื่อลบ"}
        FormHelperTextProps={{ sx: { fontSize: "0.68rem", mx: 0 } }}
      />
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1 }}>
        <Button
          size="small" component="a" target="_blank" rel="noopener noreferrer"
          href={mapSearchUrl(site, company)}
          startIcon={<GoogleMapsPin size={15} />}
          sx={{ textTransform: "none", fontWeight: 600, color: SUB }}
        >
          ค้นหาใน Maps
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small" onClick={() => { setDraft(null); setError(""); setAnchor(null); }} disabled={saving}
          sx={{ textTransform: "none", color: SUB }}
        >
          ยกเลิก
        </Button>
        <Button
          size="small" variant="contained" onClick={save} disabled={saving}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, boxShadow: "none" }}
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </Stack>
    </Box>
  );

  // ── โหมดกะทัดรัด (ช่องในตาราง) ───────────────────────────────────────
  if (compact) {
    return (
      <>
        <Stack direction="row" alignItems="center" spacing={0.25} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={url ? "เปิดแผนที่นำทาง" : "ยังไม่มีพิกัด — กดเพื่อค้นหาใน Google Maps"}>
            <IconButton
              size="small" component="a" target="_blank" rel="noopener noreferrer"
              href={url || mapSearchUrl(site, company)}
              sx={{ p: 0.35, color: url ? "#059669" : "#cbd5e1", "&:hover": { color: url ? "#047857" : SUB } }}
            >
              <GoogleMapsPin size={16} />
            </IconButton>
          </Tooltip>
          {canEdit && (
            <Tooltip title={url ? "แก้ลิงก์แผนที่" : "บันทึกพิกัดของโครงการนี้"}>
              <IconButton
                size="small"
                onClick={(e) => { setDraft(url || ""); setAnchor(e.currentTarget); }}
                sx={{ p: 0.35, color: "#cbd5e1", "&:hover": { color: SUB } }}
              >
                <Edit sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Popover
          open={Boolean(anchor)} anchorEl={anchor}
          onClose={() => { setAnchor(null); setDraft(null); setError(""); }}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          PaperProps={{ sx: { borderRadius: 2.5 } }}
        >
          {editor}
        </Popover>
      </>
    );
  }

  if (draft !== null) {
    return (
      <Box onClick={(e) => e.stopPropagation()}>
        <TextField
          size="small" fullWidth autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="วางลิงก์ที่แชร์จาก Google Maps"
          error={Boolean(error)}
          helperText={error || "กดค้นหาด้านล่าง → เจอตำแหน่งแล้วกด แชร์ → คัดลอกลิงก์ → วางที่นี่ · เว้นว่างเพื่อลบ"}
          FormHelperTextProps={{ sx: { fontSize: "0.68rem", mx: 0 } }}
        />
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1 }}>
          <Button
            size="small" component="a" target="_blank" rel="noopener noreferrer"
            href={mapSearchUrl(site, company)}
            startIcon={<GoogleMapsPin size={15} />}
            sx={{ textTransform: "none", fontWeight: 600, color: SUB }}
          >
            ค้นหาใน Maps
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small" onClick={() => { setDraft(null); setError(""); }} disabled={saving}
            sx={{ textTransform: "none", color: SUB }}
          >
            ยกเลิก
          </Button>
          <Button
            size="small" variant="contained" onClick={save} disabled={saving}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, boxShadow: "none" }}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={0.75} onClick={(e) => e.stopPropagation()}>
      {url ? (
        <Button
          size={size} component="a" href={url} target="_blank" rel="noopener noreferrer"
          startIcon={<GoogleMapsPin size={16} />}
          endIcon={<OpenInNew sx={{ fontSize: 13 }} />}
          sx={{
            textTransform: "none", fontWeight: 700, borderRadius: 2,
            color: "#047857", bgcolor: "rgba(16,185,129,.10)",
            border: "1px solid rgba(16,185,129,.30)",
            "&:hover": { bgcolor: "rgba(16,185,129,.18)" },
          }}
        >
          เปิดแผนที่นำทาง
        </Button>
      ) : (
        <Button
          size={size} component="a" target="_blank" rel="noopener noreferrer"
          href={mapSearchUrl(site, company)}
          startIcon={<GoogleMapsPin size={16} />}
          endIcon={<OpenInNew sx={{ fontSize: 13 }} />}
          sx={{
            textTransform: "none", fontWeight: 600, borderRadius: 2,
            color: SUB, border: "1px solid", borderColor: BORDER,
            "&:hover": { bgcolor: "#f8fafc" },
          }}
        >
          ค้นหาตำแหน่งใน Maps
        </Button>
      )}
      {canEdit && (
        <Tooltip title={url ? "แก้ลิงก์แผนที่ของโครงการนี้" : "บันทึกพิกัดของโครงการนี้"}>
          <IconButton
            size="small" onClick={() => setDraft(url || "")}
            sx={{ color: SUB, border: "1px solid", borderColor: BORDER, borderRadius: 2, flexShrink: 0 }}
          >
            <Edit sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      )}
      {!url && !canEdit && (
        <Typography variant="caption" sx={{ color: SUB }}>ยังไม่มีพิกัดบันทึกไว้</Typography>
      )}
    </Stack>
  );
}
