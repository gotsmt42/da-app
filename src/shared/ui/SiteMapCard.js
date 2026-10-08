/**
 * SiteMapCard — การ์ดแผนที่หน้างาน (Google Maps ฝังในหน้า) แบบเดียวกับฟอร์มงานช่าง (EditEvent.js · ee-map-card)
 *
 * ✅ ผู้ใช้สั่ง (8 ต.ค. 2569): "ให้มีการแสดงแมพแบบของช่าง" (หน้ารายละเอียดนัดฝ่ายขาย)
 *   • มีพิกัดที่บันทึกไว้ในทะเบียนลูกค้า → แปลงเป็นตำแหน่งจริง (CustomerService.resolveMapEmbed) แล้วฝังแผนที่
 *   • ยังไม่มี → แผนที่ค้นหาจากชื่อโครงการ + บอกชัดว่าเป็นตำแหน่งโดยประมาณ
 *   • แถบล่าง: ชื่อสถานที่ · สถานะพิกัด · ปุ่ม นำทาง/ค้นหา + แก้พิกัด (SiteMapLink ตัวเดิม — สิทธิ์เดิม)
 * ⚠️ พิกัดผูกกับ "บริษัท + โครงการ" ในทะเบียนลูกค้า (ไม่ใช่ที่ตัวงาน) — ใช้แคชเดียวกับ SiteMapLink (useSiteMapUrl)
 */
import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import CustomerService from "@/shared/services/CustomerService";
import SiteMapLink, { useSiteMapUrl, mapEmbedSrc, GoogleMapsPin } from "./SiteMapLink";

export default function SiteMapCard({ company, site, canEdit = false, height = 200 }) {
  const { url, saved } = useSiteMapUrl(company, site);
  const [src, setSrc] = useState("");
  const [exact, setExact] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let loc = null;
      if (url) { try { loc = await CustomerService.resolveMapEmbed(url); } catch { loc = null; } }
      if (!alive) return;
      setExact(Boolean(url && loc));
      setSrc(mapEmbedSrc(loc, site || company));
    })();
    return () => { alive = false; };
  }, [url, site, company]);

  if (!site && !company) return null;

  return (
    <Box sx={{ borderRadius: 2.5, overflow: "hidden", border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
      <Box sx={{ position: "relative", height, bgcolor: "#f1f5f9" }}>
        {src ? (
          <Box component="iframe" title={`แผนที่ ${site || company}`} src={src} loading="lazy"
            referrerPolicy="no-referrer-when-downgrade" allowFullScreen
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, color: "#94a3b8", fontSize: "0.8rem" }}>
            กำลังโหลดแผนที่…
          </Stack>
        )}
      </Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, borderTop: "1px solid #e2e8f0", flexWrap: "wrap", rowGap: 0.75 }}>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Stack direction="row" spacing={0.6} alignItems="center">
            <GoogleMapsPin size={15} />
            <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 800, color: "#0f172a" }}>{site || company}</Typography>
          </Stack>
          <Typography sx={{ fontSize: "0.72rem", color: saved && exact ? "#64748b" : "#b45309" }}>
            {saved && exact ? "ตำแหน่งที่บันทึกไว้ของโครงการนี้"
              : saved ? "แสดงจากชื่อโครงการ — ลิงก์ที่บันทึกไว้แปลงเป็นแผนที่ไม่ได้ (กดนำทางได้ตามปกติ)"
                : "ตำแหน่งโดยประมาณจากชื่อโครงการ — ยังไม่ได้บันทึกพิกัด"}
          </Typography>
        </Box>
        <SiteMapLink company={company} site={site} canEdit={canEdit} />
      </Stack>
    </Box>
  );
}
