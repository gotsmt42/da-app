/**
 * AssignDialog — เลือกช่างที่จะรับงานใบนี้ (หลายคนได้)
 *
 * ⚠️ ส่ง userIds "ทั้งชุด" เสมอ ไม่ใช่ส่งเฉพาะคนที่เพิ่ม — ฝั่ง server ถือว่าชุดที่ส่งมาคือชุดล่าสุด
 * คนที่หายไปจากชุดคือคนที่ถูกถอดออก (และ server จะคงความคืบหน้าของคนที่ยังอยู่ไว้ ไม่รีเซ็ต)
 *
 * ⚠️ ติ๊กออกคนที่ทำงานไปแล้วต้องเตือนก่อน — ถอดออกแล้วบันทึก/รูปของคนนั้นจะหายไปจากใบด้วย
 */
import { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography,
  Checkbox, Avatar, Alert, CircularProgress, TextField, InputAdornment, Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Search } from "@mui/icons-material";

import DispatchService from "../services/DispatchService";
import { DISPATCH_ACCENT, TEXT_SUB, BORDER_MAIN } from "../dispatchMeta";

export default function AssignDialog({ open, dispatch, onClose, onAssigned }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setUsers(await DispatchService.assignable()); }
    catch (err) { setError(err?.response?.data?.message || "ดึงรายชื่อช่างไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    setSelected((dispatch?.assignees || []).map((a) => String(a.userId)));
    setSearch("");
  }, [open, dispatch, load]);

  const toggle = (id) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    if (!selected.length) return setError("กรุณาเลือกผู้รับงานอย่างน้อย 1 คน");
    setSaving(true); setError("");
    try { onAssigned?.(await DispatchService.assign(dispatch._id, selected)); }
    catch (err) { setError(err?.response?.data?.message || err?.message || "มอบหมายไม่สำเร็จ"); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  const q = search.trim().toLowerCase();
  const shown = users.filter((u) =>
    !q || [u.fname, u.lname, u.username].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
  );
  const progressOf = (id) => (dispatch?.assignees || []).find((a) => String(a.userId) === id);
  // คนที่กำลังจะถูกถอดออก ทั้งที่ทำงานไปแล้ว
  const removingActive = (dispatch?.assignees || [])
    .filter((a) => !selected.includes(String(a.userId)) && a.status !== "assigned");

  return (
    <Dialog open onClose={() => !saving && onClose?.()} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>เลือกผู้รับงาน</Typography>
        <Typography variant="caption" sx={{ color: TEXT_SUB }}>
          เลือกได้หลายคน · แต่ละคนจะมีสถานะและบันทึกของตัวเองแยกกัน
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 1.5 }}>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {removingActive.length > 0 && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            กำลังถอด {removingActive.map((a) => a.name).join(", ")} ออก — บันทึกและรูปที่ส่งไว้จะหายไปจากใบนี้ด้วย
          </Alert>
        )}

        <TextField
          size="small" fullWidth placeholder="ค้นหาชื่อช่าง" value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 17, color: TEXT_SUB }} /></InputAdornment> }}
          sx={{ mb: 1 }}
        />

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={26} /></Box>
        ) : shown.length === 0 ? (
          <Typography variant="body2" sx={{ color: TEXT_SUB, textAlign: "center", py: 3 }}>
            {users.length === 0 ? "ยังไม่มีช่างในระบบ — เพิ่มผู้ใช้สิทธิ์ \"ช่าง\" ที่หน้าพนักงานก่อน" : "ไม่พบชื่อที่ค้นหา"}
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {shown.map((u) => {
              const id = String(u._id);
              const checked = selected.includes(id);
              // 🧹 ป้าย "สถานะรายคน" ถูกตัดออกแล้ว — ความคืบหน้าจริงอยู่ที่สถานะงานในตารางงาน
              const alreadyOn = Boolean(progressOf(id));
              // 🐛 ที่แก้ (ผู้ใช้แจ้งว่า "หน้านี้มีนามสกุล หน้าอื่นๆไม่มี"): เดิมโชว์ "ชื่อ + นามสกุล"
              // อยู่หน้าเดียวในระบบ ที่เหลือ (ฟอร์มของช่าง/หน้าภาระงาน/การ์ดงาน) ใช้ชื่อต้นล้วน
              // ⚠️ ไม่ใช่แค่เรื่องความสวยงาม — ชื่อที่เลือกตรงนี้ถูกเขียนลงฟิลด์ team/responsiblePerson
              // ของแผนงานจริง ซึ่งทั้งระบบใช้ "ชื่อต้น" เป็นคีย์จับคู่คน (ดู personName() ฝั่ง server)
              // ถ้าโชว์คนละแบบกับที่บันทึก คนกดจะไม่มีทางรู้ว่าค่าที่บันทึกจริงคืออะไร
              const name = String(u.fname || "").trim() || u.username;
              return (
                <Stack
                  key={id} direction="row" alignItems="center" spacing={1}
                  onClick={() => toggle(id)}
                  sx={{
                    px: 1, py: 0.75, borderRadius: 2, cursor: "pointer",
                    border: "1px solid", borderColor: checked ? alpha(DISPATCH_ACCENT, 0.45) : BORDER_MAIN,
                    bgcolor: checked ? alpha(DISPATCH_ACCENT, 0.06) : "transparent",
                    "&:hover": { borderColor: DISPATCH_ACCENT },
                  }}
                >
                  <Checkbox size="small" checked={checked} sx={{ p: 0.4 }} />
                  <Avatar sx={{ width: 26, height: 26, fontSize: "0.72rem", fontWeight: 800 }}>
                    {(name || "?").charAt(0)}
                  </Avatar>
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.85rem", fontWeight: 600 }} noWrap>{name}</Typography>
                  {alreadyOn && (
                    <Chip size="small" label="มอบหมายแล้ว" sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, bgcolor: alpha(DISPATCH_ACCENT, 0.12), color: "#b45309" }} />
                  )}
                </Stack>
              );
            })}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 1.5 }}>
        <Typography variant="caption" sx={{ color: TEXT_SUB, flex: 1, pl: 0.5 }}>
          เลือกแล้ว {selected.length} คน
        </Typography>
        <Button onClick={() => onClose?.()} disabled={saving} sx={{ textTransform: "none" }}>ยกเลิก</Button>
        <Button
          variant="contained" onClick={submit} disabled={saving || !selected.length}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: DISPATCH_ACCENT, "&:hover": { bgcolor: "#d97706" } }}
        >
          {saving ? "กำลังบันทึก..." : "มอบหมาย"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
