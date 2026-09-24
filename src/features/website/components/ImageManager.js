import { useRef, useState } from "react";
import { Box, Button, IconButton, LinearProgress, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { AddPhotoAlternate, ArrowBack, ArrowForward, DeleteOutline, Star } from "@mui/icons-material";

import WebsiteService, { errorText } from "../services/WebsiteService";
import { UI } from "./WebsiteUi";

/**
 * จัดการรูปของรายการหนึ่ง — อัปโหลดหลายรูป · เรียงลำดับ · ตั้งรูปปก · ข้อความแทนรูป · ลบ
 *
 * ✅ บริษัทสั่ง "สินค้าต้องมีรูปภาพ" — ทุกรายการที่มีรูปใช้ตัวนี้ตัวเดียว หน้าตาและการใช้งานเหมือนกันหมด
 * ⚠️ รูปแรกคือรูปปกเสมอ (เว็บใช้รูปแรกบนการ์ด) — ปุ่ม "ตั้งเป็นรูปปก" แค่ย้ายรูปไปไว้ตำแหน่งแรก
 * ⚠️ อัปโหลดเสร็จ ≠ ขึ้นเว็บ — ต้องกดบันทึกรายการด้วย (บอกผู้ใช้ไว้ใต้กล่องเสมอ)
 *    รูปที่อัปแล้วถูกลบออกก่อนบันทึก server จะลบไฟล์ให้ตอนบันทึก (เทียบรายการเก่า/ใหม่)
 */

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

export default function ImageManager({ value = [], onChange, max = 12, single = false, label = "รูปภาพ", onError }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [progress, setProgress] = useState(0);
  const images = single ? value.slice(0, 1) : value;
  const room = (single ? 1 : max) - images.length;

  const pick = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const bad = list.find((f) => !ACCEPT.split(",").includes(f.type));
    if (bad) return onError?.(`"${bad.name}" ไม่ใช่รูป JPG / PNG / WebP`);
    const big = list.find((f) => f.size > MAX_BYTES);
    if (big) return onError?.(`"${big.name}" ใหญ่เกิน 10 MB`);
    const take = list.slice(0, Math.max(0, room));
    if (take.length < list.length) onError?.(`เพิ่มได้อีก ${room} รูป — ข้ามรูปที่เกินไป`);

    const added = [];
    setUploading(take.length);
    try {
      // ⚠️ อัปทีละรูปตามลำดับ ไม่ยิงพร้อมกัน — มือถือเน็ตช้าอัป 6 รูปพร้อมกันจะหลุดครึ่งหนึ่ง
      for (const f of take) {
        setProgress(0);
        const r = await WebsiteService.upload(f, setProgress);
        added.push({ url: r.url, publicId: r.publicId, width: r.width, height: r.height, alt: "" });
        setUploading((n) => n - 1);
      }
    } catch (err) {
      onError?.(errorText(err, "อัปโหลดรูปไม่สำเร็จ"));
    } finally {
      setUploading(0);
      if (added.length) onChange(single ? added.slice(0, 1) : [...images, ...added]);
    }
  };

  const move = (i, dir) => {
    const next = [...images];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const makeCover = (i) => onChange([images[i], ...images.filter((_, k) => k !== i)]);
  const remove = (i) => onChange(images.filter((_, k) => k !== i));
  const setAlt = (i, alt) => onChange(images.map((img, k) => (k === i ? { ...img, alt } : img)));

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.88rem" }}>{label}</Typography>
        {!single && <Typography sx={{ color: UI.sub, fontSize: "0.78rem" }}>{images.length}/{max} รูป · รูปแรกคือรูปปก</Typography>}
      </Stack>

      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(3, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" } }}>
        {images.map((img, i) => (
          <Box key={img.publicId || img.url} sx={{ border: `1px solid ${i === 0 ? UI.accent : UI.border}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
            <Box sx={{ position: "relative", aspectRatio: "4 / 3", bgcolor: UI.soft }}>
              <Box component="img" src={img.url} alt={img.alt || ""} loading="lazy"
                sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
              {i === 0 && !single && (
                <Box sx={{ position: "absolute", top: 6, left: 6, bgcolor: UI.accent, color: "#fff", fontSize: "0.68rem", fontWeight: 800, px: 0.75, py: 0.2, borderRadius: 1 }}>
                  รูปปก
                </Box>
              )}
            </Box>
            <Stack direction="row" alignItems="center" sx={{ px: 0.5, py: 0.25, borderTop: `1px solid ${UI.border}` }}>
              {!single && (
                <>
                  <Tooltip title="เลื่อนไปทางซ้าย"><span><IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="เลื่อนไปทางซ้าย"><ArrowBack sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                  <Tooltip title="เลื่อนไปทางขวา"><span><IconButton size="small" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label="เลื่อนไปทางขวา"><ArrowForward sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                  {i !== 0 && <Tooltip title="ตั้งเป็นรูปปก"><IconButton size="small" onClick={() => makeCover(i)} aria-label="ตั้งเป็นรูปปก"><Star sx={{ fontSize: 16 }} /></IconButton></Tooltip>}
                </>
              )}
              <Box sx={{ flex: 1 }} />
              <Tooltip title="เอารูปนี้ออก"><IconButton size="small" color="error" onClick={() => remove(i)} aria-label="เอารูปนี้ออก"><DeleteOutline sx={{ fontSize: 17 }} /></IconButton></Tooltip>
            </Stack>
            <TextField
              value={img.alt || ""} onChange={(e) => setAlt(i, e.target.value.slice(0, 200))}
              placeholder="คำอธิบายรูป (ช่วย SEO)" size="small" fullWidth variant="standard"
              InputProps={{ disableUnderline: true, sx: { fontSize: "0.78rem", px: 1, py: 0.5 } }}
              sx={{ borderTop: `1px solid ${UI.border}` }}
            />
          </Box>
        ))}

        {room > 0 && (
          <Button
            onClick={() => inputRef.current?.click()} disabled={uploading > 0} variant="outlined" color="inherit"
            sx={{ aspectRatio: "4 / 3", minHeight: 110, borderStyle: "dashed", borderColor: UI.border, borderRadius: 2, flexDirection: "column", gap: 0.75, textTransform: "none", color: UI.sub }}
          >
            <AddPhotoAlternate />
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 700 }}>{uploading ? `กำลังอัป… เหลือ ${uploading}` : single ? "เลือกรูป" : "เพิ่มรูป"}</Typography>
            <Typography sx={{ fontSize: "0.7rem" }}>JPG · PNG · WebP ≤ 10 MB</Typography>
          </Button>
        )}
      </Box>

      {uploading > 0 && <LinearProgress variant="determinate" value={progress} sx={{ mt: 1.5, borderRadius: 1 }} />}
      <input ref={inputRef} type="file" hidden multiple={!single} accept={ACCEPT}
        onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
      <Typography sx={{ color: UI.sub, fontSize: "0.75rem", mt: 1 }}>
        รูปจะขึ้นเว็บหลังกด "บันทึก" รายการนี้ · รูปพื้นขาวหรือพื้นโปร่งใสดูดีที่สุดบนการ์ดสินค้า
      </Typography>
    </Box>
  );
}
