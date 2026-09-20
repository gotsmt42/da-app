/**
 * เมนู "ติดต่อ" บนหัวเว็บ — ✅ ผู้ใช้สั่ง: "อยากให้มีไอคอนช่องทางการติดต่อ และให้ลิงก์ไป
 * โดยกำหนดลิงก์ในตั้งค่าของ Super Admin"
 *
 * ⚠️ รวมทุกช่องทางไว้ใต้ไอคอนเดียว ไม่ได้เรียงไอคอนหลายอันบนแถบ — แถบบนมือถือเพิ่งถูกจัดให้
 * เหลือเท่าที่จำเป็น (โลโก้ · กระดิ่ง · ปุ่มเมนู) การเติมไอคอนทีละช่องทางจะกลับไปล้นจออีก
 * และจำนวนช่องทางเปลี่ยนได้ตามที่ผู้ดูแลตั้ง — เมนูเดียวจึงรองรับได้ทุกกรณี
 * ⚠️ ไม่มีช่องทางไหนถูกตั้งไว้เลย = ไม่แสดงปุ่มนี้ (ปุ่มที่กดแล้วเจอเมนูว่างแย่กว่าไม่มีปุ่ม)
 * ⚠️ มีช่องทางเดียว = กดแล้วไปเลย ไม่ต้องเปิดเมนูให้เสียจังหวะ
 */
import { useState } from "react";
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from "reactstrap";
import { FaHeadset, FaPhoneAlt, FaEnvelope, FaLine, FaFacebookF, FaGlobe } from "react-icons/fa";
import useOrgSettings from "@/shared/hooks/useOrgSettings";
import { contactChannels } from "@/shared/services/OrgSettingService";

const ICON = {
  phone: FaPhoneAlt,
  email: FaEnvelope,
  line: FaLine,
  facebook: FaFacebookF,
  website: FaGlobe,
};

/** สีประจำช่องทาง — ช่วยให้กวาดตาเจอไวกว่าไอคอนสีเดียวกันทั้งแถว */
const COLOR = {
  phone: "#0ea5e9",
  email: "#f59e0b",
  line: "#06c755",
  facebook: "#1877f2",
  website: "#64748b",
};

export default function HeaderContactMenu() {
  const org = useOrgSettings();
  const [open, setOpen] = useState(false);
  const channels = contactChannels(org);

  if (!channels.length) return null;

  // ⚠️ ทุกลิงก์ต้องมี rel="noopener noreferrer" — เป็นลิงก์ออกนอกเว็บที่ผู้ดูแลตั้งเอง
  const linkProps = (c) => ({
    href: c.href,
    target: c.external ? "_blank" : undefined,
    rel: c.external ? "noopener noreferrer" : undefined,
  });

  if (channels.length === 1) {
    const only = channels[0];
    const Icon = ICON[only.key] || FaHeadset;
    return (
      <a {...linkProps(only)} className="header-contact-btn" title={only.label} aria-label={only.label}>
        <Icon size={15} />
      </a>
    );
  }

  return (
    <Dropdown isOpen={open} toggle={() => setOpen((o) => !o)}>
      <DropdownToggle
        tag="button" type="button" className="header-contact-btn"
        title="ช่องทางติดต่อ" aria-label="ช่องทางติดต่อ"
      >
        <FaHeadset size={15} />
      </DropdownToggle>
      <DropdownMenu end className="modern-dropdown-menu">
        <div className="dropdown-section-label">ช่องทางติดต่อ</div>
        {channels.map((c) => {
          const Icon = ICON[c.key] || FaHeadset;
          return (
            <a key={c.key} {...linkProps(c)} style={{ textDecoration: "none" }}>
              <DropdownItem className="dropdown-item-icon">
                <Icon size={14} color={COLOR[c.key]} /> {c.label}
              </DropdownItem>
            </a>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
}
