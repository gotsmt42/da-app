import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "reactstrap";
import { Switch } from "@mui/material";
import {
  FaBell,
  FaBuilding,
  FaUsers,
  FaBoxOpen,
  FaWarehouse,
  FaChevronRight,
  FaInfoCircle,
  FaSignOutAlt,
  FaTags,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { useAuth } from "../auth/AuthContext";
import PushService from "../services/PushService";
import { swalLogout } from "../functions/user";

const version = process.env.REACT_APP_VERSION;

const Settings = () => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userData?.role?.toLowerCase() === "admin";

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (PushService.isSupported()) {
      PushService.isSubscribed().then(setPushSubscribed);
    }
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

  const handleLogout = async () => {
    const result = await swalLogout();
    if (result.isConfirmed) {
      logout();
      Swal.fire("Logout Success!", "", "success");
    }
  };

  const initials = (userData?.fname?.charAt(0) || userData?.username?.charAt(0) || "U").toUpperCase();

  // ✅ /product กับ /product/stock มีหน้าเว็บจริงอยู่แล้ว (ดู src/routes/Router.js) แต่ไม่เคย
  // มีลิงก์เข้าถึงจาก Sidebar/เมนูไหนเลยมาก่อน — ใส่เป็นทางลัดไว้ที่นี่ให้แอดมินกดถึงได้จริง
  const adminLinks = [
    { title: "ลูกค้า", desc: "จัดการฐานข้อมูลลูกค้า", link: "/customer", icon: <FaBuilding size={18} />, color: "#3b82f6" },
    { title: "พนักงาน", desc: "จัดการสิทธิ์และข้อมูลพนักงาน", link: "/employee", icon: <FaUsers size={18} />, color: "#f43f5e" },
    { title: "สินค้า", desc: "จัดการรายการสินค้าในระบบ", link: "/product", icon: <FaBoxOpen size={18} />, color: "#dc2626" },
    { title: "สต็อกสินค้า", desc: "ตรวจสอบจำนวนคงเหลือในคลัง", link: "/product/stock", icon: <FaWarehouse size={18} />, color: "#b91c1c" },
    { title: "ประเภทงาน / ระบบ", desc: "จัดการตัวเลือกใน dropdown ตอนเพิ่ม/แก้ไขแผนงาน", link: "/worktype", icon: <FaTags size={18} />, color: "#8b5cf6" },
  ];

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
          <span style={styles.roleBadge}>{userData?.role || "User"}</span>
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

      {/* ─── การจัดการระบบ (เฉพาะแอดมิน) ─── */}
      {isAdmin && (
        <>
          <h5 style={styles.sectionTitle}>การจัดการระบบ</h5>
          {adminLinks.map((item, idx) => (
            <div
              key={idx}
              style={styles.card}
              className="settings-row-hover"
              onClick={() => navigate(item.link)}
            >
              <div style={{ ...styles.iconCircle, backgroundColor: `${item.color}18`, color: item.color }}>
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={styles.rowTitle}>{item.title}</p>
                <p style={styles.rowDesc}>{item.desc}</p>
              </div>
              <FaChevronRight style={styles.chevron} />
            </div>
          ))}
        </>
      )}

      {/* ─── เกี่ยวกับแอป ─── */}
      <h5 style={styles.sectionTitle}>เกี่ยวกับแอป</h5>
      <div style={styles.card}>
        <div style={{ ...styles.iconCircle, backgroundColor: "rgba(100,116,139,0.12)" }}>
          <FaInfoCircle size={16} color="#64748b" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.rowTitle}>Do All Architect and Engineering</p>
          <p style={styles.rowDesc}>เวอร์ชัน {version || "-"}</p>
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
