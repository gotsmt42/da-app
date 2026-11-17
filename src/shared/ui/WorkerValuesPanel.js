/**
 * WorkerValuesPanel — มูลค่างานรายคน
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "ผู้ปฏิบัติงาน 1 ใส่มูลค่าเข้างานโครงการนั้นครั้งนั้น 5000 คนที่ 2 ลง 3000
 *    แล้วไม่รวมมูลค่ากัน ให้แยกตามคน และเช็คการเชื่อมโยงข้อมูลกันให้สมบูรณ์ไม่ผิดพลาด")
 *    เดิมทุกคนบันทึกลงช่องเดียว (workValue) → คนหลังทับคนแรก · รายงานรายช่างให้ทุกคนได้ยอดเดียวกัน
 *    ตอนนี้แต่ละคนมีรายการของตัวเอง (PUT /events/:id/worker-value) · ไม่รวมเป็นมูลค่างานของงาน (ผู้ใช้เลือก)
 *
 * variant
 *   "mine"   — ช่าง: ช่องเดียว "มูลค่างานของฉันครั้งนี้"
 *   "list"   — ผู้รับผิดชอบ/ผู้อนุมัติ: การ์ดรายชื่อทุกคนในทีม ลง/แก้แทนได้
 *   "inline" — รายชื่อแบบย่อ (ใส่ใน InfoLine ของการ์ดงาน)
 */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { GroupsRounded } from "@mui/icons-material";
import WorkValueField from "./WorkValueField";
import Swal from "./swal";
import EventService from "@/shared/services/EventService";
import { workersOfRows, personValueOf, myWorkerName } from "@/shared/utils/workValue";

const LINE = "#e2e8f0";

/**
 * @param event      งาน (วันที่แสดงอยู่)
 * @param sessions   ทุกวันของงาน (ไม่ส่ง = [event])
 * @param me         { userId, fname } ผู้ใช้ปัจจุบัน
 * @param canManage  ลง/แก้แทนคนอื่นได้ (ผู้รับผิดชอบ/ผู้อนุมัติ) — server ตรวจซ้ำ
 * @param disabled   ล็อกทั้งหมด (เช่น งานปิดแล้วสำหรับคนที่ไม่ใช่ผู้อนุมัติ)
 * @param onPatched  (docs[]) → อัปเดตรายการในหน้าแม่ (ทุกวันของงาน)
 */
export default function WorkerValuesPanel({ event, sessions, me, canManage = false, disabled = false, onPatched, variant = "list" }) {
  const baseRows = useMemo(() => (sessions?.length ? sessions : [event]), [sessions, event]);
  // ค่าที่เพิ่งบันทึก — แสดงทันทีแม้หน้าแม่ยังไม่ได้อัปเดต (ล้างเมื่อข้อมูลจากหน้าแม่เปลี่ยน)
  const [override, setOverride] = useState(null);
  useEffect(() => { setOverride(null); }, [event?.workerValues]);
  const rows = useMemo(() => (override ? baseRows.map((r) => ({ ...r, workerValues: override })) : baseRows), [baseRows, override]);

  const workers = useMemo(() => workersOfRows(rows), [rows]);
  const myName = useMemo(() => myWorkerName(rows, me), [rows, me]);

  const save = async (name, amount, meta = {}) => {
    try {
      const res = await EventService.SetWorkerValue(event._id, {
        name: name === myName ? undefined : name, amount, vatIncluded: meta.workValueVatIncluded,
      });
      const list = res?.workerValues || [];
      setOverride(list);
      onPatched?.((res?.eventIds?.length ? res.eventIds : [event._id]).map((id) => ({ _id: id, workerValues: list })));
    } catch (err) {
      Swal.fire({ icon: "error", title: "บันทึกมูลค่างานไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่อีกครั้ง" });
      throw err;
    }
  };

  if (variant === "mine") {
    if (!myName) return null;
    const v = personValueOf(rows, myName);
    return (
      <Box>
        <WorkValueField label="มูลค่างานของฉันครั้งนี้" value={v ? v.amount : null} vatIncluded={v?.vatIncluded} event={event}
          noSuggest disabled={disabled} emptyText="ยังไม่ใส่ (ไม่บังคับ)" onSave={(amount, meta) => save(myName, amount, meta)} />
        <Typography sx={{ mt: 0.5, px: 0.5, fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.45 }}>
          ลงเฉพาะยอดของคุณ · คนอื่นในทีมลงของตัวเอง ไม่ทับกันและไม่รวมกัน
        </Typography>
      </Box>
    );
  }

  if (!workers.length) return null;
  const filled = workers.filter((n) => personValueOf(rows, n)).length;

  const list = (
    <Stack spacing={variant === "inline" ? 0.25 : 0}>
      {workers.map((name, i) => {
        const v = personValueOf(rows, name);
        const isMe = name === myName;
        const editable = !disabled && (canManage || isMe);
        return (
          <Stack key={name} direction="row" alignItems="center" gap={1}
            sx={variant === "inline" ? { minHeight: 28 } : { px: 1.25, py: 0.75, borderTop: i ? `1px solid ${LINE}` : 0 }}>
            <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.84rem", fontWeight: 700, color: "#1e293b" }}>
              {name}
              {i === 0 && <Box component="span" sx={{ ml: 0.5, fontSize: "0.68rem", fontWeight: 600, color: "#64748b" }}>หัวหน้าทีม</Box>}
              {isMe && <Box component="span" sx={{ ml: 0.5, fontSize: "0.68rem", fontWeight: 700, color: "#2563eb" }}>คุณ</Box>}
              {v?.legacy && <Box component="span" title="ยอดที่ลงไว้ก่อนแยกรายคน" sx={{ ml: 0.5, fontSize: "0.66rem", fontWeight: 600, color: "#94a3b8" }}>ยอดเดิม</Box>}
            </Typography>
            <WorkValueField compact value={v ? v.amount : null} vatIncluded={v?.vatIncluded} event={event} noSuggest
              disabled={!editable} onSave={(amount, meta) => save(name, amount, meta)} />
          </Stack>
        );
      })}
    </Stack>
  );

  if (variant === "inline") return list;

  return (
    <Box sx={{ borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff", overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.25, py: 0.9, bgcolor: "#f8fafc", borderBottom: `1px solid ${LINE}` }}>
        <GroupsRounded sx={{ fontSize: 18, color: "#2563eb" }} />
        <Typography sx={{ flex: 1, fontSize: "0.84rem", fontWeight: 800, color: "#1e293b" }}>มูลค่างานรายคน</Typography>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: filled < workers.length ? "#b45309" : "#15803d" }}>
          ลงแล้ว {filled}/{workers.length} คน
        </Typography>
      </Stack>
      {list}
      <Typography sx={{ px: 1.25, py: 0.75, borderTop: `1px solid ${LINE}`, fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.45 }}>
        แต่ละคนลงยอดของตัวเอง · ไม่นำไปรวมเป็นมูลค่างานของงาน · ใช้ในรายงานรายช่าง
      </Typography>
    </Box>
  );
}
