// EventForms/EventReceive.js

export const getEventReceive = async ({
  arg,
  EventService,
  fetchEventsFromDB,
  Swal,
  moment,
}) => {
  const event = arg.event;
  const eventId = event.id; // ดึง ID จริงของงานที่เราผูกติดมาจากฝั่ง Sidebar

  // 1. คำนวณวันที่ผู้ใช้ลากเมาส์ไปปล่อยลงบนตารางปฏิทิน
  const start = moment(event.start).format("YYYY-MM-DD");
  
  // ตรวจสอบโครงสร้าง End Date เผื่อกรณีลากวางข้ามวันแบบ AllDay
  const end = event.end 
    ? moment(event.end).format("YYYY-MM-DD") 
    : start; 

  // 2. ลบ element ตัวลากวางพรีวิวออกไปก่อนเพื่อเตรียมให้ปฏิทินวาดใหม่จาก State
  arg.revert();

  try {
    // 3. ยิง API อัปเดตงานเดิมที่เคยค้างในถังพัก ให้มีวันที่เริ่ม-สิ้นสุดจริงๆ เสียที
    await EventService.UpdateEvent(eventId, {
      start,
      end,
      allDay: event.allDay ?? true
    });

    console.log(`✅ งานรหัส ${eventId} ถูกจัดลงตารางวันที่ ${start} เรียบร้อย`);
    
    // 4. สั่งโหลดข้อมูลใหม่จาก DB รวดเดียว (State ทั้งในปฏิทินและใน Sidebar จะอัปเดตสลับที่กันอัตโนมัติ)
    await fetchEventsFromDB();

  } catch (error) {
    console.error("❌ ไม่สามารถจัดตารางงานล่วงหน้าได้:", error);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกวันลงตารางปฏิทินได้", "error");
  }
};