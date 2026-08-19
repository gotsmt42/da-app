/**
 * JobDocsChip.js — แถบไอคอนบอกว่า "ครั้งที่ N" นี้มีเอกสารอะไรแนบไว้บ้าง กดแล้วเปิดดูได้
 *
 * ⚠️ แสดงเฉพาะชนิดที่ "มีไฟล์จริง" เท่านั้น — ถ้าโชว์ครบ 4 ชนิดทุกช่องแบบจางๆ ตารางจะมีไอคอน
 * 48 อันต่อแถว (4 ชนิด × 12 ครั้ง) ซึ่งกลบข้อมูลจริงจนหมด และงานส่วนใหญ่มีเอกสารแค่ 1-2 ชนิด
 * ✅ ผลคือ "ไม่มีเอกสาร = ไม่มีอะไรโผล่เลย" ซึ่งอ่านง่ายที่สุดและเป็นกรณีที่พบบ่อยที่สุดด้วย
 *
 * ⚠️ ใช้ไอคอน/สีชุดเดียวกับหน้า "การดำเนินงาน" เป๊ะๆ (utils/jobDocTypes.js) — คนที่แนบไฟล์เห็น
 * ไอคอนพวกนี้ทุกวันอยู่แล้ว จำได้ทันทีโดยไม่ต้องอ่านชื่อ ถ้าใช้คนละชุดจะต้องเรียนรู้ใหม่ 2 รอบ
 */
import { memo } from "react";
import { Box, Stack, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AttachFile } from "@mui/icons-material";
import { roundDocs } from "../../utils/jobDocTypes";

/**
 * @param {Array}    props.roundVisits  งานทุก document ของครั้งนี้
 * @param {Function} props.onOpen       เปิดกล่องเอกสารของครั้งนี้ — ส่งกลับเป็น rowKey/round/title
 *                                      (ไม่ส่ง array กลับไป เพราะฝั่งที่เปิดกล่องต้องดึงข้อมูลสดจาก
 *                                      state เองทุกครั้ง ไม่งั้นไฟล์ที่เห็นจะเป็นชุดที่เก่าค้างไว้)
 * @param {boolean}  props.compact      true = ตารางเดสก์ท็อป · false = การ์ดมือถือ
 */
function JobDocsChip({ roundVisits = [], rowKey, round, title, onOpen, compact = true, canUpload = false }) {
  const groups = roundDocs(roundVisits);

  // ✅ ไม่มีเอกสารเลย + เป็นคนที่แนบไฟล์ได้ → โชว์ปุ่มคลิปจางๆ ให้กดเข้าไปแนบได้
  // ⚠️ จำเป็นต้องมี ไม่งั้น "ครั้งที่ยังไม่มีเอกสาร" จะไม่มีอะไรให้กดเลยสักจุด = แนบไฟล์ครั้งแรก
  // ไม่ได้ ต้องไปเริ่มที่หน้าการดำเนินงานอยู่ดี ซึ่งขัดกับที่เพิ่งเปิดให้แนบจากตรงนี้ได้
  // ⚠️ ยังคงหลักเดิมไว้: คนที่แนบไม่ได้ (ช่าง/ผู้ดูอย่างเดียว) เห็น "ไม่มีเอกสาร = ไม่มีอะไรโผล่"
  // เหมือนเดิมเป๊ะ ตารางจึงไม่รกขึ้นสำหรับคนกลุ่มนั้น
  if (groups.length === 0) {
    if (!canUpload) return null;
    return (
      <Tooltip title="ยังไม่มีเอกสารของครั้งนี้ — คลิกเพื่อแนบไฟล์" placement="top">
        <Box
          component="button" type="button"
          onClick={(e) => { e.stopPropagation(); onOpen?.(rowKey, round, title); }}
          sx={{
            border: "none", bgcolor: "transparent", p: 0.15, m: 0, borderRadius: 1,
            cursor: "pointer", lineHeight: 1, display: "inline-flex", alignItems: "center",
            color: "text.disabled", opacity: 0.45,
            transition: "opacity .15s, background-color .15s",
            "&:hover": { opacity: 1, bgcolor: alpha("#0f172a", 0.06) },
          }}
        >
          <AttachFile sx={{ fontSize: compact ? 13 : 15 }} />
        </Box>
      </Tooltip>
    );
  }

  const total = groups.reduce((n, g) => n + g.files.length, 0);
  const tip = [
    ...groups.map((g) => `${g.label} ${g.files.length} ไฟล์`),
    "— คลิกเพื่อเปิดดู",
  ].join(" · ");
  const size = compact ? 13 : 15;

  return (
    <Tooltip title={tip} placement="top">
      <Stack
        component="button" type="button" direction="row" alignItems="center"
        spacing={0.3}
        onClick={(e) => { e.stopPropagation(); onOpen?.(rowKey, round, title); }}
        sx={{
          border: "none", bgcolor: "transparent", p: 0.15, m: 0, borderRadius: 1,
          cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
          transition: "background-color .15s",
          "&:hover": { bgcolor: alpha("#0f172a", 0.06) },
        }}
      >
        {groups.map(({ key, color, Icon, files }) => (
          <Box key={key} component="span" sx={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
            <Icon sx={{ fontSize: size, color, opacity: 0.9 }} />
            {/* ⚠️ บอกจำนวนเฉพาะตอนมีมากกว่า 1 ไฟล์ — เลข "1" ต่อท้ายทุกไอคอนคือเสียงรบกวนล้วนๆ
                เพราะการมีไอคอนอยู่ก็แปลว่ามีอย่างน้อย 1 ไฟล์อยู่แล้ว */}
            {files.length > 1 && (
              <Box component="span" sx={{ fontSize: compact ? "0.55rem" : "0.62rem", fontWeight: 800, color, ml: "1px" }}>
                {files.length}
              </Box>
            )}
          </Box>
        ))}
        {/* ตัวเลขรวมท้ายแถบ เฉพาะตอนมีหลายชนิด — สรุปได้ในสายตาเดียวว่าครั้งนี้มีเอกสารกี่ไฟล์ */}
        {groups.length > 1 && (
          <Box component="span" sx={{ fontSize: compact ? "0.55rem" : "0.62rem", fontWeight: 700, color: "text.disabled", ml: 0.15 }}>
            ({total})
          </Box>
        )}
      </Stack>
    </Tooltip>
  );
}

// ✅ memo — เหตุผลเดียวกับ BillingChip: ตารางมีป้ายนี้ได้ถึง 12 อันต่อแถว และหน้านี้ render ใหม่
// ทั้งหน้าทุกครั้งที่ state ใดๆ เปลี่ยน · ได้ผลจริงเพราะ roundVisits ที่ส่งเข้ามามี reference คงที่
// (ดู roundVisitsOf ที่ ContractOverview.js ซึ่งแคชด้วย WeakMap)
export default memo(JobDocsChip);
