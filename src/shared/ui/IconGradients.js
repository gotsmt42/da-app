/**
 * IconGradients — ไล่สีให้ไอคอนเมนู (อ่อน → เข้ม มุมซ้ายบน → ขวาล่าง) ให้ดูมีมิติแบบแอปสมัยใหม่
 *
 * ✅ (1 พ.ย. 2569 ผู้ใช้: "icon ดูแข็ง ไม่โมเดิร์น" · "หน้าจอคอมให้เป็นรูปแบบ icon เหมือนกัน")
 *    ใช้ร่วมกันทั้งหน้าแรกมือถือ (MobileHome) และจอคอม (HomeMenu) — ไอคอนหน้าตาเดียวกันทุกจอ
 * วิธีใช้:  <IconGradients tones={["#dc2626", ...]} />  วางครั้งเดียวในหน้า
 *          <Icon style={gradFill("#dc2626")} />           ไอคอนอ้างสีไล่ตามรหัสสี
 * ⚠️ รับเฉพาะรหัสสีแบบ #rrggbb — สีแบบอื่น gradFill คืน undefined (ไอคอนใช้สีทึบตาม CSS แทน)
 */
const HEX = /^#[0-9a-f]{6}$/i;

const mixWhite = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const m = (c) => Math.round(c + (255 - c) * amt).toString(16).padStart(2, "0");
  return `#${m(n >> 16)}${m((n >> 8) & 255)}${m(n & 255)}`;
};
const gradId = (hex) => `appg-${String(hex).replace("#", "").toLowerCase()}`;

/** style สำหรับไอคอน: fill ด้วยสีไล่ของรหัสสีนั้น */
export const gradFill = (hex) => (HEX.test(hex || "") ? { fill: `url(#${gradId(hex)})` } : undefined);

export default function IconGradients({ tones = [] }) {
  const list = [...new Set(tones.filter((t) => HEX.test(t || "")).map((t) => t.toLowerCase()))];
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        {list.map((t) => (
          <linearGradient key={t} id={gradId(t)} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={mixWhite(t, 0.3)} />
            <stop offset="100%" stopColor={t} />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}
