import { showTeamOverlapWarning } from "@/shared/utils/teamOverlapWarning";

export const getEventResize = async ({
  arg,
  events,
  fetchEventsFromDB,
  setEvents,
  EventService,
  userData, // ✅ ใช้ตั้งชื่อผู้ทำรายการใน activityLog (ดู logEntry ด้านล่าง)
  Swal,
  moment,
}) => {
  const event = arg.event;

  // 🐛 ที่แก้ (เทียบบั๊กเดียวกับ EventDrop.js — "Cast to date failed... Invalid date" ตอนขยาย/ย่อ
  // นัดที่มีเวลาเป๊ะของฝ่ายขาย): เดิมลบ 1 วันออกจาก end เสมอไม่ว่า allDay หรือไม่ ทั้งที่กฎ exclusive-
  // end มีไว้ใช้กับงานทั้งวันเท่านั้น และไม่กันกรณี event.endStr เป็นสตริงว่าง (FullCalendar คืนแบบนี้
  // ได้) ซึ่งพอผ่าน moment() ที่ไม่ valid แล้ว .subtract() จะได้ "Invalid Date" ส่งให้ Mongoose cast
  // เป็น Date ไม่ได้ → 500
  const isAllDayEvt = Boolean(event.allDay);
  const endSrc = event.endStr || event.startStr; // ✅ กัน endStr เป็นสตริงว่างเสมอ
  const startM = moment(event.startStr);
  const endM = moment(endSrc);
  const start = isAllDayEvt ? startM.format("YYYY-MM-DD") : startM.toISOString();
  const end = isAllDayEvt ? endM.format("YYYY-MM-DD") : endM.toISOString();

  const updatedEvent = {
    id: event.id,
    // title: event.title,
    // textColor: event.textColor,
    // backgroundColor: event.backgroundColor,
    // fontSize: event.extendedProps?.fontSize?.toString() || "12",
    start,
    end,
    allDay: event.allDay,
  };

  // ตรวจสอบว่า event มีการเปลี่ยนแปลงจริงหรือไม่ — เทียบด้วย timestamp เต็ม (ไม่ใช่แค่วันที่) กันพลาด
  // ตอนงานมีเวลา ซึ่งอาจเปลี่ยนแค่เวลาในวันเดียวกัน
  const originalStartMs = moment(event.extendedProps?.start).valueOf();
  const originalEndMs = moment(event.extendedProps?.end || event.extendedProps?.start).valueOf();

  const hasChanged = startM.valueOf() !== originalStartMs || endM.valueOf() !== originalEndMs;

  if (!hasChanged) {
    console.log("⏸️ ไม่มีการเปลี่ยนแปลงขนาด ไม่ต้องอัปเดต");
    return;
  }

  // ✅ บันทึกประวัติ — เดิมการลากขยาย/ย่อวันที่งานไม่เคยถูกบันทึกลง activityLog เลย ทำให้ประวัติของงาน
  // มีช่องโหว่ (เห็นแค่ที่แก้ผ่านฟอร์ม ไม่เห็นที่ลากปรับบนปฏิทินโดยตรง) เทียบ pattern เดียวกับ
  // buildChangeLogEntries ใน EditEvent.js
  // ⚠️ ข้อความประวัติต้องอ่านง่ายเสมอ ไม่ว่า start/end ด้านบนจะเป็น "YYYY-MM-DD" (allDay) หรือ
  // ISO datetime เต็ม (งานมีเวลา) — จัดรูปแบบแยกจากค่าที่ส่งขึ้น server
  const logDateFmt = isAllDayEvt ? "D MMM YYYY" : "D MMM YYYY HH:mm";
  const startLabel = startM.locale("th").format(logDateFmt);
  const endLabel = endM.locale("th").format(logDateFmt);
  const actorName = [userData?.fname, userData?.lname].filter(Boolean).join(" ") || userData?.username || "ผู้ใช้งาน";
  updatedEvent.activityLog = [
    ...(event.extendedProps?.activityLog || []),
    {
      action: "schedule_changed",
      detail: `ลากปรับวันที่เป็น ${startLabel}${endLabel !== startLabel ? ` – ${endLabel}` : ""}`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    },
  ];

  try {
    await EventService.UpdateEvent(event.id, updatedEvent);

    // อัปเดตทันทีแบบ optimistic ให้เห็นผลไว ๆ ก่อน
    setEvents((prevEvents) =>
      prevEvents.map((e) =>
        e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e
      )
    );

    // แล้วรีเฟรชเงียบ ๆ เพื่อให้ตรงกับข้อมูลจริงบนเซิร์ฟเวอร์เสมอ (เผื่อมีผลข้างเคียงอื่น)
    await fetchEventsFromDB(true);

    // ✅ ไม่บล็อกแล้ว (เดิม backend เช็คช่างชนกันแล้วปฏิเสธ ตัดออกไปแล้ว) แต่ยังแจ้งเตือนเบาๆ ให้รู้ตัว
    showTeamOverlapWarning({ Swal, moment, events, movedEvent: event, start, end });

    console.log(`✅ Event ${event.id} resized`);
  } catch (error) {
    console.error("❌ Error resizing event:", error);
  }
};
