/**
 * JobDocuments — แท็บ "เอกสารประจำงาน" ในหน้าเอกสาร
 * ✅ (21 ต.ค. 2569 ผู้ใช้: "หน้าเอกสารปรับ UX/UI ใหม่ จัดวาง ดูง่าย") เดิมซ้อนอยู่ในแท็บ "ไฟล์แนบของงาน" อีกชั้น
 *    แยกออกมาเป็นแท็บของตัวเอง หัวหน้าแบบเดียวกับแท็บอื่น
 */
import { Box } from "@mui/material";
import { Description } from "@mui/icons-material";
import { PageHeader, PAGE_SX } from "@/shared/ui/PageKit";
import ServiceReportFiles from "../components/ServiceReportFiles";

export default function JobDocuments() {
  return (
    <Box sx={PAGE_SX}>
      <PageHeader
        icon={<Description />}
        title="เอกสารประจำงาน"
        subtitle="Service Report · ใบเสนอราคา · ใบวางบิล · ใบส่งมอบงาน ที่แนบไว้กับแต่ละงาน"
      />
      <ServiceReportFiles />
    </Box>
  );
}
