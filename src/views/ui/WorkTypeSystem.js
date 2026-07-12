import { useState } from "react";
import { Container } from "reactstrap";
import { Tabs, Tab, Box } from "@mui/material";
import { Build, Memory } from "@mui/icons-material";
import LookupManager from "../../components/Settings/LookupManager";
import JobTypeService from "../../services/JobTypeService";
import SystemTypeService from "../../services/SystemTypeService";

// ✅ เดิม "ประเภทงาน"/"ระบบ" เป็น array ฝังโค้ดตายตัวในฟอร์มเพิ่ม/แก้ไขแผนงาน (AddEvent.js/
// EditEvent.js) แก้ไขเองไม่ได้เลยนอกจากแก้โค้ด — ย้ายมาเป็นตารางจัดการได้จริงเหมือนโครงการ
// (Customer) รวมสองรายการไว้หน้าเดียวด้วยแท็บ แทนที่จะแยกเป็น 2 หน้า/2 ลิงก์เมนู ให้ไม่เกะกะ
const WorkTypeSystem = () => {
  const [tab, setTab] = useState(0);

  return (
    <Container fluid style={styles.container}>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>ประเภทงาน / ระบบ</h2>
        <p style={styles.pageSub}>จัดการตัวเลือกที่ใช้ตอนเพิ่ม/แก้ไขแผนงาน</p>
      </div>

      <Box sx={styles.card}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 40, mb: 2,
            "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 700, fontSize: "13.5px" },
            "& .Mui-selected": { color: "#dc2626 !important" },
            "& .MuiTabs-indicator": { backgroundColor: "#dc2626" },
          }}
        >
          <Tab icon={<Build sx={{ fontSize: 16 }} />} iconPosition="start" label="ประเภทงาน" />
          <Tab icon={<Memory sx={{ fontSize: 16 }} />} iconPosition="start" label="ระบบ" />
        </Tabs>

        {tab === 0 && (
          <LookupManager
            title="ประเภทงาน"
            icon={<Build sx={{ fontSize: 18, color: "#dc2626" }} />}
            service={JobTypeService}
            itemLabel="ประเภทงาน"
          />
        )}
        {tab === 1 && (
          <LookupManager
            title="ระบบ"
            icon={<Memory sx={{ fontSize: 18, color: "#dc2626" }} />}
            service={SystemTypeService}
            itemLabel="ระบบ"
          />
        )}
      </Box>
    </Container>
  );
};

const styles = {
  container: {
    padding: "16px 14px 40px 14px",
    backgroundColor: "#f8fafc",
    width: "100%",
    minHeight: "100vh",
  },
  pageHeader: { marginBottom: "18px" },
  pageTitle: { fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0 },
  pageSub: { fontSize: "12px", color: "#94a3b8", margin: "2px 0 0 0" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    padding: "16px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.015)",
  },
};

export default WorkTypeSystem;
