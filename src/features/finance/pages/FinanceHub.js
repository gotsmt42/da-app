/**
 * FinanceHub — หน้า "ใบเสนอราคา / การเงิน" หน้าเดียวจบ
 *
 * ✅ รวม 2 หน้าที่เป็น "คนละช่วงของสายงานเดียวกัน" (เสนอราคา → ทำงาน → วางบิล → รับเงิน):
 *   • "ติดตามใบเสนอราคา" (/quotations) เคยอยู่ใต้หมวด "เอกสาร"
 *   • "วางบิล / รับเงิน" (/billing) เคยอยู่ใต้หมวด "การเงิน"
 * เดิมอยู่คนละหมวดกันทั้งที่คนที่ตามเรื่องเงินของงานหนึ่งต้องดูทั้งสองฝั่งเสมอ (ใบเสนอราคาที่ลูกค้า
 * อนุมัติแล้ว → ถึงเวลาวางบิลหรือยัง → รับเงินครบหรือยัง)
 *
 * ⚠️ ในโค้ดเดิมมีคอมเมนต์ระบุว่า "ตั้งใจแยก" เพราะคนเข้าดูคนละกลุ่ม (บัญชี vs ผู้ปฏิบัติงาน) —
 * ผู้ใช้ยืนยันให้รวมแล้ว และของจริงทั้ง 2 หน้าจำกัดสิทธิ์ไว้ที่ admin/manager เท่ากันอยู่แล้ว
 * (ดู guard ในตัว QuotationTracking/BillingTracking) จึงไม่ได้เปิดข้อมูลการเงินให้ใครเพิ่มจากเดิม
 *
 * 🐛 ที่แก้ไปพร้อมกัน: เดิมเมนู "ติดตามใบเสนอราคา" ถูกโชว์ให้ช่างเห็นด้วย แต่ตัวหน้ากลับ redirect
 * ช่างออกไป /dashboard ทันทีที่กด = เมนูที่กดแล้วเด้งทิ้งทุกครั้ง ตอนนี้เมนูโชว์เฉพาะคนที่เข้าได้จริง
 */
import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { RequestQuote, AccountBalanceWallet } from "@mui/icons-material";
import TabbedPage from "@/shared/ui/TabbedPage";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";

const QuotationTracking = lazy(() => import("./QuotationTracking"));
const BillingTracking = lazy(() => import("./BillingTracking"));

const FinanceHub = () => {
  const { userData } = useAuth();
  // ✅ ช่างเข้าหน้านี้ได้แล้ว (ตามที่ผู้ใช้ระบุ) — เห็นและอัปเดตเฉพาะ "งานของตัวเอง" ไม่ว่าจะเป็น
  // ผู้รับผิดชอบ หัวหน้าทีม หรือลูกทีม
  // ⚠️ การจำกัดขอบเขตข้อมูลทำที่ฝั่ง server ทั้งหมด ไม่ได้พึ่งการซ่อนเมนู/หน้าจอ:
  //   • GET /event-op คืนเฉพาะงานที่ผู้ใช้คนนั้นมีชื่ออยู่ (ทั้ง 2 แท็บดึงจาก endpoint นี้)
  //   • ทุก route ที่บันทึกข้อมูลการเงิน/การติดตาม เช็คสิทธิ์ "รายงาน" ซ้ำอีกชั้น
  //     (requireEventFinanceAccess / isJobParticipant)
  // จึงไม่ต้องกันด้วย role ที่นี่อีก — และไม่ควรกัน เพราะจะกลายเป็นกันคนที่มีสิทธิ์จริงออกไปด้วย
  const canAccess = can(userData, "viewFinance");

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  return (
    <TabbedPage
      tabs={[
        {
          key: "quotations",
          label: "ติดตามใบเสนอราคา",
          icon: <RequestQuote sx={{ fontSize: 18 }} />,
          render: () => <QuotationTracking />,
        },
        {
          key: "billing",
          label: "วางบิล / รับเงิน",
          icon: <AccountBalanceWallet sx={{ fontSize: 18 }} />,
          render: () => <BillingTracking />,
        },
      ]}
    />
  );
};

export default FinanceHub;
