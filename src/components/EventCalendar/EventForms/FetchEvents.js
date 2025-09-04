export const getFetchEvents = async ({
  defaultFontSize,
  setEvents,
  setLoading,
  EventService,
  fetchThaiHolidaysFromAPI,
}) => {
  setLoading(true);
  try {
    // ดึงข้อมูล events จากฐานข้อมูล
    const res = await EventService.getEvents();
    const eventsWithId = res.userEvents.map((event) => ({
      ...event,
      id: event._id,
      extendedProps: {
        ...event.extendedProps,
        company: event.company,
        site: event.site,
        system: event.system,
        time: event.time,
        manualStatus: event.manualStatus,
        status: event.status,
        fontSize: event.fontSize,
      },
    }));

    // ดึงข้อมูลวันหยุดจาก API
    const thaiHolidays = await fetchThaiHolidaysFromAPI();
    // console.log("Fetched holidays:", thaiHolidays);

    // ตรวจสอบว่าได้ข้อมูลวันหยุดแล้วหรือไม่
    if (thaiHolidays.length > 0) {
      const combinedEvents = [
        ...eventsWithId,
        ...thaiHolidays.map((holiday) => ({
          ...holiday,
          fontSize: defaultFontSize.extendedProps, // Apply default font size
        })),
      ]; // console.log("Combined events:", combinedEvents); // ตรวจสอบข้อมูลที่รวมกันแล้ว

      // อัปเดตข้อมูลใน state
      setEvents(combinedEvents);
    } else {
      console.log("No holidays found, only user events will be displayed.");
      setEvents(eventsWithId);
    }
  } catch (error) {
    console.error("Error fetching events or holidays:", error);
  } finally {
    setLoading(false);
  }
};
