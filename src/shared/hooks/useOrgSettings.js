/**
 * useOrgSettings — ค่าตั้งค่าองค์กรสำหรับวาดหน้าจอ (โลโก้ · ชื่อบริษัท)
 *
 * ✅ โหลดครั้งเดียวต่อการเปิดแอป แล้วทุกหน้าจอใช้ค่าก้อนเดียวกัน (ดู OrgSettingService)
 * ✅ แก้ค่าจากเครื่องไหนก็ตาม → ทุกจอที่เปิดอยู่เปลี่ยนตามทันทีผ่านสัญญาณเรียลไทม์ (topic "settings")
 */
import { useEffect, useState } from "react";
import OrgSettingService, { ORG_FALLBACK } from "@/shared/services/OrgSettingService";
import useRealtime from "@/shared/realtime/useRealtime";

export default function useOrgSettings() {
  const [settings, setSettings] = useState(() => OrgSettingService.current());

  useEffect(() => {
    const off = OrgSettingService.subscribe(setSettings);
    OrgSettingService.load().then(setSettings);
    return off;
  }, []);

  useRealtime("settings", () => { OrgSettingService.load({ force: true }); });

  return settings || ORG_FALLBACK;
}
