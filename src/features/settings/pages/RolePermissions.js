/**
 * RolePermissions — ตั้งค่าสิทธิ์: ใครเห็นเมนูอะไร และจัดการอะไรได้บ้าง
 *
 * ✅ ผู้ใช้สั่ง: "อยากให้ตั้งค่ากำหนดสิทธิ์ได้ด้วยว่าอยากให้ใครมองเห็นเมนูอะไร และจัดการอะไรได้บ้าง เอาพอสังเขป"
 * → ตารางติ๊ก: แถว = สิ่งที่ทำได้ (เขียนเป็นภาษาคน) · คอลัมน์ = สิทธิ์ผู้ใช้ · ติ๊กแล้วบันทึกทันที
 *
 * 🔒 กติกากันล็อกตัวเอง (server บังคับซ้ำที่ routes/settings.js — ที่นี่แค่ปิดปุ่มให้เห็นก่อน):
 *   • กรรมการผู้จัดการมีสิทธิ์เต็มเสมอ แก้ไม่ได้ — ต้องเหลือทางกลับเข้าหน้านี้เสมอ
 *   • ปิด "จัดการระบบ" ของสิทธิ์ตัวเองไม่ได้
 * ⚠️ ตารางนี้ปรับได้เฉพาะรายการ "พอสังเขป" ที่อธิบายเป็นภาษาคนได้ — กฎควบคุมภายในของเอกสารการเงิน
 * (เช่น อนุมัติใบของตัวเองได้ไหม / คนตรวจกับคนอนุมัติต้องคนละคน) ยังตายตัวในโค้ดเสมอ
 */
import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Box, Stack, Typography, Checkbox, Alert, Snackbar, CircularProgress, Tooltip, Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AdminPanelSettings, Lock, InfoOutlined } from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import PermissionService from "@/shared/services/PermissionService";
import useRealtime from "@/shared/realtime/useRealtime";

const ACCENT = "#7c3aed";
const TEXT_SUB = "#64748b";
const BORDER = "#e2e8f0";

/**
 * คำอธิบายแต่ละสิทธิ์เป็นภาษาคน — จัดกลุ่มตามที่ผู้ใช้คิดเป็นเรื่องๆ ไม่ใช่ตามชื่อตัวแปรในโค้ด
 * ⚠️ ต้องครอบคลุมทุกตัวใน EDITABLE_CAPABILITIES ฝั่ง server — ตัวที่ไม่มีคำอธิบายจะถูกซ่อนไปเงียบๆ
 */
const GROUPS = [
  {
    title: "งานและปฏิทิน",
    items: [
      ["viewAllJobs", "เห็นงานของทั้งบริษัท", "ไม่ติ๊ก = เห็นเฉพาะงานของตัวเอง"],
      ["viewServiceCalendar", "เปิดดูตารางงานช่าง", "ดูอย่างเดียว ไม่ได้สิทธิ์แก้งาน"],
      ["editAnyJob", "แก้ไขงานของคนอื่น", ""],
      ["editOperation", "อัปเดตสถานะ/การดำเนินงาน", ""],
      ["approveJobs", "อนุมัติแผนงาน / คำขอปิดงาน", ""],
    ],
  },
  {
    title: "ใบมอบหมายงาน (Dispatch)",
    items: [
      ["requestDispatch", "ขอลงงาน (ส่งคำขอให้ช่าง)", ""],
      ["assignDispatch", "จัดคิวและมอบหมายงาน", ""],
      ["receiveDispatch", "รับงานและอัปเดตความคืบหน้า", "สำหรับช่างหน้างาน"],
    ],
  },
  {
    title: "เอกสารและการเงิน",
    items: [
      ["editDocuments", "ออก/แก้เอกสาร (ใบส่งมอบ ฯลฯ)", ""],
      ["viewFinance", "เห็นเมนูการเงิน / ใบเสนอราคา", ""],
      ["editFinance", "บันทึกวางบิล / รับเงิน", ""],
      ["viewContracts", "เห็นสัญญา", ""],
      ["editContracts", "แก้ไขสัญญา", ""],
      ["createSalesPlan", "สร้างงานขาย / นัดหมายลูกค้า", ""],
    ],
  },
  {
    title: "ระบบเบิกค่าใช้จ่าย",
    items: [
      ["requestExpense", "ออกใบเบิก / ใบเคลมของตัวเอง", "ส่วนที่ 1 ของสายอนุมัติ"],
      ["reviewExpense", "ตรวจสอบใบเบิก", "ส่วนที่ 2 มือแรก"],
      ["approveExpense", "อนุมัติใบเบิก", "ส่วนที่ 2 มือสอง"],
      ["disburseExpense", "อนุมัติเบิกจ่าย (เงินออกจริง)", "ส่วนที่ 3"],
      ["viewAllExpenses", "เห็นใบเบิกของทุกคน + เบิกแทนคนอื่น", ""],
    ],
  },
  {
    title: "ข้อมูลหลักและระบบ",
    items: [
      ["manageMasterData", "จัดการลูกค้า / ประเภทงาน / ระบบ", ""],
      ["manageAll", "จัดการระบบและผู้ใช้ (รวมหน้านี้)", "⚠️ ปิดของสิทธิ์ตัวเองไม่ได้"],
    ],
  },
];

export default function RolePermissions() {
  const { can, role: myRole } = usePermissions();
  const { userData } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      setData(await PermissionService.matrix());
    } catch (err) {
      setError(err?.response?.data?.message || "โหลดตารางสิทธิ์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // ✅ คนอื่นปรับสิทธิ์อยู่พร้อมกัน → ตารางอัปเดตเอง
  useRealtime("settings", () => { load({ silent: true }); });

  if (!can("manageAll")) return <Navigate to="/about" replace />;

  const isOn = (role, cap) => Boolean(data?.effective?.[cap]?.includes(role));

  const toggle = async (role, cap, next) => {
    setSaving(`${role}:${cap}`); setError("");
    // อัปเดตหน้าจอทันที แล้วค่อยยืนยันกับ server (ผิดเมื่อไรดึงของจริงกลับมาทับ)
    setData((cur) => {
      const effective = { ...cur.effective };
      const list = new Set(effective[cap] || []);
      if (next) list.add(role); else list.delete(role);
      effective[cap] = [...list];
      return { ...cur, effective };
    });
    try {
      const res = await PermissionService.setOne({ role, capability: cap, allowed: next });
      setData((cur) => ({ ...cur, ...res }));
      setToast("บันทึกสิทธิ์แล้ว — มีผลกับทุกคนทันที");
    } catch (err) {
      setError(err?.response?.data?.message || "บันทึกสิทธิ์ไม่สำเร็จ");
      load({ silent: true });
    } finally {
      setSaving("");
    }
  };

  if (loading) {
    return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>;
  }

  const roles = data?.roles || [];

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1200, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AdminPanelSettings />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", color: "#0f172a", lineHeight: 1.25 }}>ตั้งค่าสิทธิ์การใช้งาน</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>
            ติ๊กว่าสิทธิ์ไหนเห็นเมนูอะไร และจัดการอะไรได้ · บันทึกทันทีที่ติ๊ก และมีผลกับทุกคนที่เปิดแอปอยู่
          </Typography>
        </Box>
      </Stack>

      <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 1.5 }}>
        กรรมการผู้จัดการมีสิทธิ์เต็มเสมอ (แก้ไม่ได้) เพื่อให้มีทางกลับเข้าหน้านี้เสมอ ·
        ปิดสิทธิ์ “จัดการระบบและผู้ใช้” ของสิทธิ์ตัวเอง ({data?.roles?.find((r) => r.role === myRole)?.label || myRole}) ไม่ได้
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>{error}</Alert>}

      <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2.5, overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{
                  position: "sticky", left: 0, zIndex: 2, bgcolor: "#f8fafc", textAlign: "left", p: 1.25,
                  borderBottom: `1px solid ${BORDER}`, minWidth: 260, fontSize: "0.85rem",
                }}>
                  สิ่งที่ทำได้ / เมนูที่เห็น
                </Box>
                {roles.map((r) => (
                  <Box component="th" key={r.role} sx={{ p: 1, borderBottom: `1px solid ${BORDER}`, bgcolor: "#f8fafc", minWidth: 96 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, lineHeight: 1.25 }}>{r.label}</Typography>
                    {r.locked && (
                      <Chip size="small" icon={<Lock sx={{ fontSize: "13px !important" }} />} label="สิทธิ์เต็ม"
                        sx={{ height: 18, mt: 0.25, fontSize: "0.63rem", fontWeight: 700, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }} />
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {GROUPS.map((group) => (
                [
                  <Box component="tr" key={group.title}>
                    <Box component="td" colSpan={roles.length + 1} sx={{ p: 0.9, pl: 1.25, bgcolor: alpha(ACCENT, 0.05), borderBottom: `1px solid ${BORDER}` }}>
                      <Typography sx={{ fontWeight: 900, fontSize: "0.82rem", color: ACCENT }}>{group.title}</Typography>
                    </Box>
                  </Box>,
                  ...group.items
                    .filter(([cap]) => (data?.capabilities || []).includes(cap))
                    .map(([cap, label, hint]) => (
                      <Box component="tr" key={cap} sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                        <Box component="td" sx={{
                          position: "sticky", left: 0, zIndex: 1, bgcolor: "inherit", p: 1.25,
                          borderBottom: `1px solid ${BORDER}`,
                        }}>
                          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{label}</Typography>
                          {hint && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{hint}</Typography>}
                        </Box>
                        {roles.map((r) => {
                          const locked = r.locked || (cap === "manageAll" && r.role === myRole);
                          const busy = saving === `${r.role}:${cap}`;
                          const checked = r.locked ? true : isOn(r.role, cap);
                          return (
                            <Box component="td" key={r.role} align="center" sx={{ borderBottom: `1px solid ${BORDER}`, textAlign: "center" }}>
                              <Tooltip
                                title={r.locked ? "กรรมการผู้จัดการมีสิทธิ์เต็มเสมอ" : locked ? "ปิดสิทธิ์จัดการระบบของสิทธิ์ตัวเองไม่ได้" : ""}
                                describeChild
                              >
                                <span>
                                  <Checkbox
                                    size="small" checked={checked} disabled={locked || busy}
                                    onChange={(e) => toggle(r.role, cap, e.target.checked)}
                                    sx={{ "&.Mui-checked": { color: ACCENT } }}
                                  />
                                </span>
                              </Tooltip>
                            </Box>
                          );
                        })}
                      </Box>
                    )),
                ]
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1.25 }}>
        ⚠️ การซ่อนเมนูเป็นเพียงการจัดหน้าจอ — ระบบยังตรวจสิทธิ์ซ้ำที่เซิร์ฟเวอร์ทุกครั้งที่บันทึกข้อมูลจริง
        · ผู้ใช้ที่เปิดแอปค้างอยู่จะเห็นเมนูใหม่ทันทีโดยไม่ต้องออกจากระบบ
        {userData?.role ? ` · คุณกำลังใช้สิทธิ์ ${data?.roles?.find((r) => r.role === myRole)?.label || userData.role}` : ""}
      </Typography>

      <Snackbar open={Boolean(toast)} autoHideDuration={2200} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" onClose={() => setToast("")}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
