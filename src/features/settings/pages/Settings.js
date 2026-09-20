import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "reactstrap";
import { Switch } from "@mui/material";
import {
  FaBell,
  FaBuilding,
  FaUsers,
  FaChevronRight,
  FaInfoCircle,
  FaSignOutAlt,
  FaTags,
  FaFileSignature,
  FaImage,
  FaUserShield,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { useAuth } from "@/features/auth/AuthContext";
import PushService from "@/shared/services/PushService";
import { swalLogout } from "@/shared/utils/user";
import { can, rankLabel } from "@/shared/utils/roles";
import useOrgSettings from "@/shared/hooks/useOrgSettings";
import { ORG_FALLBACK } from "@/shared/services/OrgSettingService";
import SignatureSettingsDialog from "../components/SignatureSettingsDialog";
import SignatureService from "@/shared/services/SignatureService";

const version = import.meta.env.REACT_APP_VERSION;
/** ชื่อแอป — คนละเรื่องกับชื่อองค์กรที่ตั้งเองได้ ต้องตรงกับ <title> และ manifest.json */
const APP_NAME = "Flowix";

const Settings = () => {
  const { userData, logout } = useAuth();
  const org = useOrgSettings();
  const navigate = useNavigate();
  const isAdmin = can(userData, "manageAll");
  // ✅ เมนูระดับ "ตั้งค่าระบบ" (โลโก้องค์กร/ตารางสิทธิ์) เห็นเฉพาะผู้ดูแลระบบสูงสุด — แยกจากการจัดการผู้ใช้
  const isSuperAdmin = can(userData, "manageSystem");

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  // ลายเซ็นอิเล็กทรอนิกส์ของผู้ใช้เอง (ใช้กับเอกสาร PDF ทุกใบที่ตัวเองออก/อนุมัติ)
  const [signOpen, setSignOpen] = useState(false);
  const [hasSignature, setHasSignature] = useState(null);

  useEffect(() => {
    if (PushService.isSupported()) {
      PushService.isSubscribed().then(setPushSubscribed);
    }
    SignatureService.me().then((sig) => setHasSignature(Boolean(sig)));
  }, []);

  // ✅ ใช้ PushService ตัวเดียวกับปุ่มกระดิ่งบน Header เป๊ะๆ — สลับที่ไหนก็ sync สถานะเดียวกัน
  const handleTogglePush = async () => {
    if (!PushService.isSupported()) {
      Swal.fire("อุปกรณ์นี้ไม่รองรับ", "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Push", "warning");
      return;
    }
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        await PushService.unsubscribe();
        setPushSubscribed(false);
        Swal.fire({ title: "ปิดการแจ้งเตือนแล้ว", icon: "success", timer: 1200, showConfirmButton: false });
      } else {
        await PushService.subscribe();
        setPushSubscribed(true);
        Swal.fire({ title: "เปิดการแจ้งเตือนแล้ว 🔔", icon: "success", timer: 1200, showConfirmButton: false });
      }
    } catch (error) {
      Swal.fire("ทำรายการไม่สำเร็จ", error.message || "กรุณาลองใหม่อีกครั้ง", "error");
    } finally {
      setPushLoading(false);
    }
  };

  /**
   * ✅ จุดออกจากระบบ "จุดเดียว" ของทั้งแอป (ผู้ใช้สั่ง "ให้เหลือแค่จุดเดียว")
   * เดิมมี 3 ที่: ดรอปดาวน์รูปโปรไฟล์บนแถบบน · ท้ายเมนูข้าง · และที่นี่
   * ⚠️ ถ้าจะเพิ่มทางออกที่อื่นอีก ให้ทบทวนก่อน — ปุ่มออกจากระบบหลายจุดคือสิ่งที่ผู้ใช้สั่งให้เลิก
   */
  const handleLogout = async () => {
    const result = await swalLogout();
    if (result.isConfirmed) {
      logout();
      Swal.fire("ออกจากระบบแล้ว", "", "success");
    }
  };

  const initials = (userData?.fname?.charAt(0) || userData?.username?.charAt(0) || "U").toUpperCase();

  // ⚠️ ไม่ใส่ "สินค้า" (/product) และ "สต็อกสินค้า" (/product/stock) ในเมนูนี้ — ผู้ใช้แจ้งว่าเป็นของเก่า
  // ที่ไม่ได้ใช้งานแล้ว (หน้ายังอยู่ในระบบและเข้าผ่าน URL ตรงได้ แต่ไม่ต้องมีทางเข้าจากหน้าตั้งค่า)
  /**
   * ⚠️ ชื่อเมนูต้องตรงกับ "ชื่อหัวข้อของหน้าปลายทาง" เป๊ะๆ — กดเมนูชื่อหนึ่งแล้วเปิดไปเจออีกชื่อหนึ่ง
   * ทำให้ผู้ใช้ไม่แน่ใจว่ามาถูกที่ไหม (เดิม "องค์กรและเอกสาร" ไปหน้าชื่อ "ตั้งค่าองค์กร" และ
   * "สิทธิ์การใช้งาน" ไปหน้าชื่อ "ตั้งค่าสิทธิ์")
   * ⚠️ คำอธิบายใช้รูปแบบเดียวกันทุกแถว: "ในนั้นมีอะไร · ไปมีผลตรงไหน"
   * และเลี่ยงศัพท์อังกฤษ (เดิมมีคำว่า dropdown ปนอยู่คำเดียวในทั้งหน้าที่เป็นไทยหมด)
   */

  /** ทะเบียนข้อมูลที่ทั้งระบบหยิบไปใช้ — ใช้คำว่า "ข้อมูลหลัก" ให้ตรงกับหมวดเดียวกันในเมนูข้าง */
  const masterDataLinks = [
    { title: "ลูกค้า", desc: "ทะเบียนลูกค้าและผู้ติดต่อ · ใช้เลือกตอนเปิดงานและออกเอกสาร", link: "/customer", icon: <FaBuilding size={18} />, color: "#3b82f6" },
    // ⚠️ เดิมเขียนว่า "จัดการสิทธิ์และข้อมูลพนักงาน" ซึ่งชนกับหัวข้อ "ตั้งค่าสิทธิ์" ด้านล่าง
    // จนดูเหมือนตั้งสิทธิ์ได้สองที่ — ที่นี่คือสิทธิ์ของคนรายคน ส่วนตารางสิทธิ์อยู่อีกหน้า
    { title: "พนักงาน", desc: "ทะเบียนพนักงาน · บัญชีผู้ใช้ · ตำแหน่งในองค์กรของแต่ละคน", link: "/employee", icon: <FaUsers size={18} />, color: "#f43f5e" },
    { title: "ประเภทงาน / ระบบ", desc: "ตัวเลือกประเภทงานและระบบงาน ที่ใช้ตอนเพิ่ม/แก้ไขแผนงาน", link: "/worktype", icon: <FaTags size={18} />, color: "#8b5cf6" },
  ];

  /** ค่าระดับระบบ — คนละชั้นสิทธิ์กับด้านบน (ผู้ดูแลระบบสูงสุดเท่านั้น) จึงต้องแยกหัวข้อ */
  const systemLinks = [
    { title: "ตั้งค่าองค์กร", desc: "โลโก้ · ข้อมูลบริษัทบนเอกสาร · ช่องทางติดต่อบนหัวเว็บ · ค่าตั้งต้นของระบบเบิก", link: "/settings/organization", icon: <FaImage size={18} />, color: "#0f766e" },
    // ✅ ผู้ใช้ขอให้แยก "สิทธิ์ในระบบ" (ผู้ดูแลระบบ/สูงสุด) กับ "สิทธิ์ในองค์กร" (ตำแหน่งงาน เปลี่ยนชื่อได้)
    { title: "ตั้งค่าสิทธิ์", desc: "สิทธิ์ในระบบ (ผู้ดูแลระบบ) · สิทธิ์ตามตำแหน่งในองค์กร", link: "/settings/permissions", icon: <FaUserShield size={18} />, color: "#7c3aed" },
  ];

  /**
   * แถวเมนูหนึ่งแถว
   * ⚠️ เป็นฟังก์ชันคืน JSX ไม่ใช่คอมโพเนนต์ที่ประกาศในตัวคอมโพเนนต์แม่ — ถ้าประกาศเป็น
   *    คอมโพเนนต์ตรงนี้ React จะมองว่าเป็นชนิดใหม่ทุกครั้งที่ re-render แล้วถอด/ใส่ DOM ใหม่ทั้งแถว
   */
  const renderLink = (item) => (
    <div key={item.link} style={styles.card} className="settings-row-hover" onClick={() => navigate(item.link)}>
      <div style={{ ...styles.iconCircle, backgroundColor: `${item.color}18`, color: item.color }}>{item.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={styles.rowTitle}>{item.title}</p>
        <p style={styles.rowDesc}>{item.desc}</p>
      </div>
      <FaChevronRight style={styles.chevron} />
    </div>
  );

  return (
    <Container fluid style={styles.container}>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>การตั้งค่า</h2>
        <p style={styles.pageSub}>จัดการบัญชี การแจ้งเตือน และระบบ</p>
      </div>

      {/* ─── โปรไฟล์ของฉัน ─── */}
      <h5 style={styles.sectionTitle}>บัญชีของฉัน</h5>
      <div style={styles.card} className="settings-row-hover" onClick={() => navigate("/account")}>
        {userData?.imageUrl ? (
          <img src={userData.imageUrl} alt="profile" style={styles.avatarImg} />
        ) : (
          <div style={styles.avatarFallback}>{initials}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.profileName}>{userData?.fname ? `${userData.fname} ${userData?.lname || ""}` : (userData?.username || "ผู้ใช้งาน")}</p>
          <span style={styles.roleBadge}>{rankLabel(userData)}</span>
        </div>
        <FaChevronRight style={styles.chevron} />
      </div>

      {/* ─── ลายเซ็นอิเล็กทรอนิกส์ ───
          ✅ อยู่ใต้ "บัญชีของฉัน" เพราะเป็นของผู้ใช้คนนั้นคนเดียว (ตั้งแทนกันไม่ได้) และทุกสิทธิ์ต้องใช้ได้
          — ช่างออกใบเบิก/ใบแจ้งเข้างานเองก็ต้องมีลายเซ็นตัวเองเหมือนกัน */}
      <div style={styles.card} className="settings-row-hover" onClick={() => setSignOpen(true)}>
        <div style={{ ...styles.iconCircle, backgroundColor: hasSignature ? "rgba(5,150,105,0.12)" : "rgba(148,163,184,0.15)" }}>
          <FaFileSignature size={16} color={hasSignature ? "#059669" : "#94a3b8"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.rowTitle}>ลายเซ็นอิเล็กทรอนิกส์</p>
          <p style={styles.rowDesc}>
            {hasSignature === null
              ? "กำลังตรวจสอบ..."
              : hasSignature
                ? "ตั้งไว้แล้ว — ใช้กับใบเบิก/ใบเคลม/ใบส่งมอบงานที่คุณออกหรืออนุมัติ"
                : "ยังไม่ได้ตั้ง — เอกสารจะเว้นช่องให้เซ็นด้วยมือ"}
          </p>
        </div>
        <FaChevronRight style={styles.chevron} />
      </div>

      {/* ─── การแจ้งเตือน ─── */}
      <h5 style={styles.sectionTitle}>การแจ้งเตือน</h5>
      <div style={styles.card}>
        <div style={{ ...styles.iconCircle, backgroundColor: pushSubscribed ? "rgba(220,38,38,0.1)" : "rgba(148,163,184,0.15)" }}>
          <FaBell size={16} color={pushSubscribed ? "#dc2626" : "#94a3b8"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.rowTitle}>การแจ้งเตือนบนอุปกรณ์นี้</p>
          <p style={styles.rowDesc}>รับการแจ้งเตือนงานใหม่/อัปเดตสถานะแบบ Push</p>
        </div>
        <Switch
          checked={pushSubscribed}
          disabled={pushLoading}
          onChange={handleTogglePush}
          sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#dc2626" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#dc2626" } }}
        />
      </div>

      {/* ─── ข้อมูลหลัก (ผู้ดูแลระบบขึ้นไป) ───
          ⚠️ เดิมทะเบียนลูกค้า/พนักงาน/ประเภทงาน ถูกยัดไว้ใต้หัวข้อ "การจัดการระบบ" รวมกับค่าระดับ
          ระบบ ทั้งที่เป็นคนละเรื่องและคนละชั้นสิทธิ์ (อันบนแค่ผู้ดูแลระบบ อันล่างต้องผู้ดูแลระบบสูงสุด)
          แถวที่กดไม่ได้จึงเคยหายไปเงียบๆ กลางหมวดโดยไม่มีอะไรบอกว่าทำไม */}
      {isAdmin && (
        <>
          <h5 style={styles.sectionTitle}>ข้อมูลหลัก</h5>
          {masterDataLinks.map(renderLink)}
        </>
      )}

      {/* ─── ตั้งค่าระบบ (ผู้ดูแลระบบสูงสุดเท่านั้น) ─── */}
      {isSuperAdmin && (
        <>
          <h5 style={styles.sectionTitle}>ตั้งค่าระบบ</h5>
          {systemLinks.map(renderLink)}
        </>
      )}

      {/* ─── เกี่ยวกับแอป ───
          🐛 เดิมช่องนี้พิมพ์ชื่อบริษัท "Do All Architect and Engineering" ไว้ตายตัวใต้หัวข้อ
          "เกี่ยวกับแอป" ซึ่งผิดสองชั้น: ชื่อที่ขึ้นเป็นชื่อ "องค์กร" ไม่ใช่ชื่อ "แอป"
          และองค์กรอื่นที่เอาระบบไปใช้ก็จะเห็นชื่อบริษัทนี้ค้างอยู่
          ✅ แสดงชื่อแอปจริงกับเวอร์ชัน แล้วบอกว่ากำลังใช้งานในนามองค์กรไหน โดยดึงชื่อองค์กร
             จากค่าที่ตั้งไว้ ไม่ฝังในโค้ด */}
      <h5 style={styles.sectionTitle}>เกี่ยวกับแอป</h5>
      <div style={styles.card}>
        <div style={{ ...styles.iconCircle, backgroundColor: "rgba(100,116,139,0.12)" }}>
          <FaInfoCircle size={16} color="#64748b" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.rowTitle}>{APP_NAME} · เวอร์ชัน {version || "-"}</p>
          <p style={styles.rowDesc}>ใช้งานในนาม {org?.nameTh || ORG_FALLBACK.nameTh}</p>
        </div>
      </div>

      {/* ─── ออกจากระบบ ─── */}
      <div style={{ ...styles.card, ...styles.logoutRow }} className="settings-row-hover" onClick={handleLogout}>
        <div style={{ ...styles.iconCircle, backgroundColor: "rgba(239,68,68,0.1)" }}>
          <FaSignOutAlt size={16} color="#ef4444" />
        </div>
        <p style={{ ...styles.rowTitle, color: "#ef4444", margin: 0 }}>ออกจากระบบ</p>
      </div>

      <style>{`
        .settings-row-hover {
          cursor: pointer;
          transition: all 0.15s ease;
          touch-action: manipulation;
        }
        .settings-row-hover:active {
          transform: scale(0.99);
          opacity: 0.9;
        }
      `}</style>
      <SignatureSettingsDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onSaved={(sig) => setHasSignature(Boolean(sig))}
      />
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
  sectionTitle: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "8px",
    marginTop: "18px",
    paddingLeft: "2px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    padding: "14px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.015)",
    marginBottom: "8px",
  },
  avatarImg: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  },
  avatarFallback: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
    color: "#fff",
    fontWeight: "700",
    fontSize: "16px",
    flexShrink: 0,
  },
  profileName: { fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: 0 },
  roleBadge: {
    display: "inline-block",
    marginTop: "3px",
    padding: "2px 8px",
    fontSize: "10px",
    fontWeight: "700",
    color: "#dc2626",
    backgroundColor: "rgba(220,38,38,0.08)",
    borderRadius: "8px",
    textTransform: "uppercase",
  },
  iconCircle: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowTitle: { fontSize: "13.5px", fontWeight: "700", color: "#0f172a", margin: 0 },
  rowDesc: { fontSize: "11px", color: "#94a3b8", margin: "2px 0 0 0" },
  chevron: { fontSize: "11px", color: "#94a3b8", flexShrink: 0 },
  logoutRow: { justifyContent: "flex-start", marginTop: "6px" },
};

export default Settings;
