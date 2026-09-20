/**
 * ค้นหารวมบนแถบบน — ช่องเดียวค้นข้ามงานและลูกค้า
 *
 * ✅ ที่มา: แอปมีช่องค้นหาแยกอยู่ในแต่ละหน้ารวม 16 หน้า แต่ค้นข้ามไม่ได้เลย
 *    คนที่รู้แค่ชื่อลูกค้าหรือเลขที่เอกสาร ต้องเดาเองก่อนว่าของที่หาอยู่หน้าไหน
 *
 * ⚠️ การมองเห็นถูกกรองที่เซิร์ฟเวอร์ด้วยตัวกรองชุดเดียวกับหน้ารายการ (ดู routes/search.js)
 *    หน้าจอนี้ไม่ได้กรองอะไรเองเลย — ห้ามเพิ่มการกรองฝั่งนี้ เพราะจะกลายเป็นด่านหลอก
 * ⚠️ หน่วงก่อนยิง 300ms — ไม่งั้นพิมพ์ชื่อลูกค้าหนึ่งชื่อยิงคำขอสิบกว่าครั้ง
 * ⚠️ ทิ้งผลลัพธ์ของคำค้นที่ล้าสมัยเสมอ — คำขอที่ยิงก่อนอาจตอบทีหลัง แล้วผลเก่าจะทับผลใหม่
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, TextField, InputAdornment, Box, Typography, Stack, CircularProgress, Divider,
} from "@mui/material";
import { FaSearch } from "react-icons/fa";
import API from "@/shared/api/axiosInstance";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

export default function HeaderSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [groups, setGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  // คำค้นล่าสุดที่ยิงไป — ใช้ทิ้งผลลัพธ์ของคำที่ผู้ใช้พิมพ์ทับไปแล้ว
  const latest = useRef("");

  const close = useCallback(() => {
    setOpen(false);
    setTerm("");
    setGroups([]);
    setSearched(false);
  }, []);

  useEffect(() => {
    const q = term.trim();
    if (q.length < MIN_CHARS) {
      setGroups([]);
      setSearched(false);
      setBusy(false);
      return undefined;
    }
    setBusy(true);
    const timer = setTimeout(() => {
      latest.current = q;
      API.get("/search", { params: { q } })
        .then((res) => {
          if (latest.current !== q) return;   // มีคำใหม่แซงไปแล้ว ทิ้งผลนี้
          setGroups(res.data?.groups || []);
          setSearched(true);
        })
        .catch(() => { if (latest.current === q) { setGroups([]); setSearched(true); } })
        .finally(() => { if (latest.current === q) setBusy(false); });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const go = (href) => { close(); navigate(href); };

  const firstHref = groups[0]?.items?.[0]?.href;

  return (
    <>
      <button
        type="button" className="header-icon-btn" onClick={() => setOpen(true)}
        title="ค้นหางานและลูกค้า" aria-label="ค้นหางานและลูกค้า"
      >
        <FaSearch size={14} />
      </button>

      <Dialog
        open={open} onClose={close} fullWidth maxWidth="sm"
        // ⚠️ ชิดบนเสมอ — กล่องที่ลอยกลางจอจะกระโดดขึ้นลงตามจำนวนผลลัพธ์ที่เปลี่ยนทุกตัวอักษรที่พิมพ์
        sx={{ "& .MuiDialog-container": { alignItems: "flex-start" } }}
        PaperProps={{ sx: { mt: { xs: 1, sm: 6 }, borderRadius: 3 } }}
      >
        <DialogContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <TextField
            autoFocus fullWidth size="small" value={term} placeholder="ค้นหางาน · ลูกค้า · เลขที่เอกสาร"
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && firstHref) go(firstHref); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {busy ? <CircularProgress size={15} /> : <FaSearch size={13} color="#94a3b8" />}
                </InputAdornment>
              ),
            }}
          />

          {term.trim().length > 0 && term.trim().length < MIN_CHARS && (
            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 1.5 }}>
              พิมพ์อย่างน้อย {MIN_CHARS} ตัวอักษร
            </Typography>
          )}

          {searched && !busy && !groups.length && (
            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 1.5 }}>
              ไม่พบรายการที่ตรงกับ “{term.trim()}”
              {/* ⚠️ ต้องบอกด้วยว่าผลลัพธ์ถูกจำกัดตามสิทธิ์ ไม่งั้นคนจะคิดว่าของหายไปจากระบบ */}
              <Box component="span" sx={{ display: "block", mt: 0.5 }}>
                ระบบค้นเฉพาะงานและลูกค้าที่คุณมีสิทธิ์เห็นเท่านั้น
              </Box>
            </Typography>
          )}

          <Stack sx={{ mt: groups.length ? 1.5 : 0 }} divider={<Divider flexItem />}>
            {groups.map((g) => (
              <Box key={g.key} sx={{ py: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 800, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.4 }}
                >
                  {g.label}
                </Typography>
                {g.items.map((it) => (
                  <Box
                    key={it.id} component="button" type="button" onClick={() => go(it.href)}
                    sx={{
                      display: "block", width: "100%", textAlign: "left", border: "none", background: "none",
                      cursor: "pointer", borderRadius: 1.5, px: 1, py: 0.75,
                      "&:hover, &:focus-visible": { bgcolor: "action.hover", outline: "none" },
                    }}
                  >
                    <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.35 }}>{it.title}</Typography>
                    {it.sub && (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{it.sub}</Typography>
                    )}
                  </Box>
                ))}
              </Box>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
