import { useEffect, useState } from "react";
import { Pagination, Stack, Typography } from "@mui/material";

/**
 * แบ่งหน้ารายการฝั่งหน้าจอ — ✅ ผู้ใช้สั่ง (6 ต.ค. 2569): "ข้อมูลที่คาดว่าจะยาวในอนาคตให้ทำระบบแบ่งหน้าไว้ด้วย"
 *
 * const pg = usePaged(list, 10);
 * pg.rows.map(...)            ← แถวของหน้าปัจจุบัน
 * <PageBar {...pg} unit="ใบ" />  ← ซ่อนเองถ้ามีหน้าเดียว
 *
 * ⚠️ รายการเปลี่ยน (เปลี่ยนตัวกรอง/ช่วงเวลา) = กลับหน้า 1 เสมอ — ไม่งั้นค้างอยู่หน้าที่ไม่มีข้อมูลแล้วดูเหมือนว่างเปล่า
 * ⚠️ ถ้าจำนวนลดลงจนหน้าปัจจุบันเกิน ใช้หน้าสุดท้ายแทน (curPage) ไม่ปล่อยให้แสดงหน้าว่าง
 */
export default function usePaged(items = [], size = 10) {
  const [page, setPage] = useState(1);
  const total = items.length;
  useEffect(() => { setPage(1); }, [total, size]);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(page, pageCount);
  return {
    rows: items.slice((cur - 1) * size, cur * size),
    page: cur, pageCount, total, size, setPage,
  };
}

/** แถบเลขหน้า + "แสดง 11–20 จาก 37 ใบ" — หน้าตาตามธีม (MuiPagination ใน app/theme.js) */
export function PageBar({ page, pageCount, total, size, setPage, unit = "รายการ", sx }) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" spacing={1}
      sx={{ mt: 1.25, pt: 1.25, borderTop: "1px solid #e2e8f0", ...sx }}
    >
      <Typography sx={{ fontSize: "0.76rem", color: "#64748b", fontWeight: 600 }}>
        แสดง {from.toLocaleString()}–{to.toLocaleString()} จาก {total.toLocaleString()} {unit}
      </Typography>
      <Pagination count={pageCount} page={page} onChange={(_, n) => setPage(n)} size="small" siblingCount={1} />
    </Stack>
  );
}
