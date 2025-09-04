export const getSaveEventToDB = async ({ newEvent, EventService }) => {
  // ตรวจสอบข้อมูลเบื้องต้นแบบเร็ว
  if (!newEvent?.start || !newEvent?.end || !newEvent?.date) {
    console.warn("⚠️ ข้อมูลไม่ครบ:", newEvent);
    return null; // ไม่ต้อง throw error เพื่อให้ flow ไม่สะดุด
  }

  try {
    return await EventService.AddEvent(newEvent);
  } catch (error) {
    console.error("❌ บันทึกแผนงานไม่สำเร็จ:", error.message);
    return null; // ส่งค่า null แทนการ throw เพื่อให้ caller จัดการได้เร็ว
  }
};
