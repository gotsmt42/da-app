export const getFetchEvents = async ({
  defaultFontSize,
  setEvents,
  setLoading,
  EventService,
  fetchThaiHolidaysFromAPI,
  silent = false,
}) => {
  if (!silent) setLoading(true);

  try {
    // เรียก API พร้อมกัน
    const [res, thaiHolidays] = await Promise.all([
      EventService.getEvents(),
      fetchThaiHolidaysFromAPI(),
    ]);

    const userEvents = Array.isArray(res?.userEvents) ? res.userEvents : [];

    // แปลงข้อมูล userEvents
    // ⚠️ ห้ามปล่อยให้ startTime/endTime หลุดไปอยู่ top-level ของ object ที่ส่งเข้า FullCalendar
    // เด็ดขาด เพราะ FullCalendar สงวนชื่อ "startTime"/"endTime" ไว้ใช้กับระบบ recurring event
    // (คู่กับ daysOfWeek) — ถ้า event มี startTime top-level ที่ parse เป็นเวลาได้ (เช่น "8:20")
    // FullCalendar จะตีความ event นั้นเป็นงานที่เกิดซ้ำทุกวันตามเวลานั้นทันที (แสดงซ้ำเต็มปฏิทิน)
    // โดยไม่ error ให้เห็นเลย จึงต้องดึง startTime/endTime ออกจาก ...event ก่อนเสมอ
    // แล้วเก็บไว้ใน extendedProps (ชื่อ custom ที่ FullCalendar ไม่แตะ) เท่านั้น
    const eventsWithId = userEvents.map((event) => {
      const { startTime: rawStartTime, endTime: rawEndTime, ...eventWithoutReservedTimeFields } = event;
      return {
        ...eventWithoutReservedTimeFields,
        id: event._id,

        extendedProps: {
          ...event.extendedProps,
          userId: event.userId, // ✅ เพิ่มเข้า extendedProps
          lastModifiedBy: event.lastModifiedBy, // ✅ เพิ่มเข้า extendedProps
          startTime: event.extendedProps?.startTime ?? rawStartTime ?? "",
          endTime: event.extendedProps?.endTime ?? rawEndTime ?? "",
        },
      };
    });


    // แปลงข้อมูลวันหยุด (ถ้ามี)
    const holidayEvents = Array.isArray(thaiHolidays)
      ? thaiHolidays.map((holiday) => ({
          ...holiday,
          extendedProps: {
            ...holiday.extendedProps,
            fontSize: defaultFontSize.extendedProps || "12",
          },
        }))
      : [];

    // รวมข้อมูลทั้งหมด
    const combinedEvents = [...eventsWithId, ...holidayEvents];

    

    // อัปเดต state ครั้งเดียว
    setEvents(combinedEvents);
  } catch (error) {
    console.error("❌ Error fetching events or holidays:", error);
    // ✅ ล้างข้อมูลเฉพาะตอนโหลดครั้งแรก (ไม่ใช่ตอน background refresh)
    // ไม่งั้น network สะดุดแค่แป๊บเดียวระหว่าง polling จะทำให้ปฏิทินว่างเปล่าทั้งที่ไม่มีอะไรผิดปกติจริง
    if (!silent) setEvents([]);
  } finally {
    if (!silent) setLoading(false);
  }
};
