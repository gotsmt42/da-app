export const getFetchEvents = async ({
  defaultFontSize,
  setEvents,
  setLoading,
  EventService,
  fetchThaiHolidaysFromAPI,
}) => {
  setLoading(true);

  try {
    // เรียก API พร้อมกัน
    const [res, thaiHolidays] = await Promise.all([
      EventService.getEvents(),
      fetchThaiHolidaysFromAPI(),
    ]);

    const userEvents = Array.isArray(res?.userEvents) ? res.userEvents : [];

    // แปลงข้อมูล userEvents
    const eventsWithId = userEvents.map((event) => ({
      ...event,
      id: event._id,
      extendedProps: {
        ...event.extendedProps,
        startTime: event.extendedProps?.startTime ?? event.startTime ?? "",
        endTime: event.extendedProps?.endTime ?? event.endTime ?? "",
      },
    }));

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
    setEvents([]); // fallback กรณี error
  } finally {
    setLoading(false);
  }
};
