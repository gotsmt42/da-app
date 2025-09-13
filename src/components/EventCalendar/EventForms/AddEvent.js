export const getAddEvent = async ({
  arg,
  events,
  setEvents,
  defaultTextColor,
  defaultBackgroundColor,
  setDefaultTextColor,
  setDefaultBackgroundColor,
  setDefaultFontSize,
  saveEventToDB,
  fetchEventsFromDB,

  CustomerService,
  AuthService,
  Swal,
  TomSelect,
  moment,
}) => {
  const [customers, employees] = await Promise.all([
    CustomerService.getCustomers(),
    AuthService.getAllUserData(),
  ]);
  const employeeList = employees?.allUser || [];

  Swal.fire({
    title: "เพิ่มแผนงานใหม่",
    customClass: "swal-wide",
    // ✅ ฟอร์มเพิ่มแผนงานแบบ 2 คอลัมน์ Responsive
    html: `
<!-- Container กึ่งกลาง -->
<div style="display: flex; justify-content: center;">
  <div class="swal-form-grid" style="
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 12px;
    font-family: 'Segoe UI', sans-serif;

  ">

    <!-- ชื่อบริษัท -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
      <label for="eventCompany" style="font-weight: bold; margin-bottom: 6px; display: block;">ชื่อบริษัท/นิติบุคคล:</label>
      <select id="eventCompany" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option selected disabled></option>
        ${customers.userCustomers
          .map((c) => `<option value="${c.cCompany}">${c.cCompany}</option>`)
          .join("")}
      </select>
    </div>

    <!-- ชื่อโครงการ -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
      <label for="eventSite" style="font-weight: bold; margin-bottom: 6px; display: block;">ชื่อโครงการ:</label>
      <select id="eventSite" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option selected disabled></option>
        ${customers.userCustomers
          .map((c) => `<option value="${c.cSite}">${c.cSite}</option>`)
          .join("")}
      </select>
    </div>

    <!-- ประเภทงาน -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
      <label for="eventTitle" style="font-weight: bold; margin-bottom: 6px; display: block;">ประเภทงาน:</label>
      <select id="eventTitle" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option selected disabled></option>
        ${[
          "LOCAL",
          "PO",
          "PM",
          "Service",
          "Training",
          "Inspection",
          "Test & Commissioning",
          "สำรวจหน้างาน",
          "ตรวจเช็คปัญหา",
          "แก้ไขปัญหา",
          "สแตนบาย",
          "เปลี่ยนอุปกรณ์",
          "ติดตั้งอุปกรณ์",
        ]
          .map((title) => `<option value="${title}">${title}</option>`)
          .join("")}
      </select>
    </div>

    <!-- ระบบงาน -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
      <label for="eventSystem" style="font-weight: bold; margin-bottom: 6px; display: block;">ระบบงาน:</label>
      <select id="eventSystem" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option selected disabled></option>
        ${["Office", "Fire Alarm", "CCTV", "Access Control", "Networks"]
          .map((sys) => `<option value="${sys}">${sys}</option>`)
          .join("")}
      </select>
    </div>

    <!-- ครั้งที่ -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
      <label for="eventTime" style="font-weight: bold; margin-bottom: 6px; display: block;">ครั้งที่:</label>
      <select id="eventTime" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option selected disabled></option>
        ${["1", "2", "3", "4"]
          .map((t) => `<option value="${t}">${t}</option>`)
          .join("")}
      </select>
    </div>

    <!-- ทีม -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
      <label for="eventTeam" style="font-weight: bold; margin-bottom: 6px; display: block;">ทีม:</label>
      <select id="eventTeam" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option selected disabled></option>
        ${employeeList
          .map((e) => `<option value="${e.fname}">${e.fname}</option>`)
          .join("")}
      </select>
    </div>

    <!-- ขนาดตัวอักษร (ซ่อนอยู่) -->
    <div style="display: none;">
      <label for="fontSize">ขนาดตัวอักษร:</label>
      <select id="fontSize" class="swal2-input">
        ${[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
          .map((size) => `<option value="${size}">${size}</option>`)
          .join("")}
      </select>
    </div>

  </div>
</div>

<!-- ส่วนล่างแนวตั้ง -->
<div style="display: flex; justify-content: center;">
  <div class="swal-form-grid" style="
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
    margin-top: 12px;
    font-family: 'Segoe UI', sans-serif;
    max-width: 1000px; /* ✅ ป้องกันไม่ให้กว้างเกิน modal */
  ">
  <div style="margin-bottom: 12px;">
    <label for="backgroundColorPicker" style="font-weight: bold;">สีพื้นหลัง:</label><br>
    <input id="backgroundColorPicker" type="color" style="width: 150px; height: 35px; border-radius: 6px;" value="${defaultBackgroundColor}" />
  </div>

  <div style="margin-bottom: 12px;">
    <label for="textColorPicker" style="font-weight: bold;">สีข้อความ:</label><br>
    <input id="textColorPicker" type="color" style="width: 150px; height: 35px; border-radius: 6px;" value="${defaultTextColor}" />
  </div>

<div style="flex: 1; min-width: 100px;">
    <label for="start" style="font-weight: bold; margin-bottom: 4px; display: block;">วันที่เริ่มต้น:</label><br>
    <input id="start" type="date"  style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;" value="${
      arg.dateStr
    }" />
  </div>

<div style="flex: 1; min-width: 100px;">
    <label for="end"style="font-weight: bold; margin-bottom: 4px; display: block;">วันที่สิ้นสุด:</label><br>
    <input id="end" type="date"  style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;" value="${
      arg.dateStr
    }" />
  </div>
</div>
</div>

<div style="display: flex; justify-content: center;">
  <div class="swal-form-grid" style="
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
    margin-top: 12px;
    font-family: 'Segoe UI', sans-serif;
    max-width: 1000px; /* ✅ ป้องกันไม่ให้กว้างเกิน modal */
  ">


<!-- เวลาเริ่ม -->
<div style="flex: 1; min-width: 100px;">
  <label for="startTime" style="font-weight: bold; margin-bottom: 4px; display: block;">เวลาเริ่ม :</label>
  <input
    id="startTime"
    type="text"
    placeholder="เช่น 08:30"

    style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;"
 
  />
</div>

<!-- เวลาสิ้นสุด -->
<div style="flex: 1; min-width: 100px;">
  <label for="endTime" style="font-weight: bold; margin-bottom: 4px; display: block;">เวลาสิ้นสุด :</label>
  <input
    id="endTime"
    type="text"
    placeholder="เช่น 17:45"

    style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;"
 
  />
</div>



  </div>
</div>


    `,

    showCancelButton: true,
    confirmButtonText: "✅ บันทึกแผนงาน",
    cancelButtonText: "🔙 ยกเลิก",
    didOpen: () => {
      new TomSelect("#eventCompany", {
        create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
        maxOptions: 7,

        placeholder: "เลือกหรือพิมพ์ชื่อบริษัท",
        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      new TomSelect("#eventSite", {
        create: true,
        maxOptions: 7,

        placeholder: "เลือกหรือพิมพ์ชื่อโครงการ",
        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      new TomSelect("#eventTitle", {
        create: true,

        placeholder: "เลือกหรือพิมพ์ชื่อหัวข้อ",
        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      new TomSelect("#eventSystem", {
        create: true,
        placeholder: "เลือกหรือพิมพ์ชื่อระบบ",
        sortField: {
          field: "text",
          direction: "asc",
        },
      });
      new TomSelect("#eventTime", {
        create: true,
        placeholder: "เลือกหรือพิมพ์ครั้งที่",

        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      new TomSelect("#eventTeam", {
        create: true,
        placeholder: "เลือกหรือพิมพ์ชื่อทีม",

        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      const textColorPicker = Swal.getPopup().querySelector("#textColorPicker");
      textColorPicker.setAttribute("value", defaultTextColor);

      const backgroundColorPicker = Swal.getPopup().querySelector(
        "#backgroundColorPicker"
      );
      backgroundColorPicker.setAttribute("value", defaultBackgroundColor);
    },
    preConfirm: () => {
      const requiredFields = ["eventSite", "eventTitle"];
      for (const id of requiredFields) {
        const value = document.getElementById(id)?.value;
        if (!value) {
          Swal.showValidationMessage(`กรุณาระบุ ${id.replace("event", "")}`);
          return false;
        }
      }

      return {
        company: document.getElementById("eventCompany")?.value || "",
        site: document.getElementById("eventSite")?.value,
        title: document.getElementById("eventTitle")?.value,
        system: document.getElementById("eventSystem")?.value,
        time: document.getElementById("eventTime")?.value,
        team: document.getElementById("eventTeam")?.value,
        backgroundColor: document.getElementById("backgroundColorPicker")
          ?.value,
        textColor: document.getElementById("textColorPicker")?.value,
        fontSize: document.getElementById("fontSize")?.value,
        start: document.getElementById("start")?.value,
        end: document.getElementById("end")?.value,

        startTime: document.getElementById("startTime")?.value,
        endTime: document.getElementById("endTime")?.value,
      };
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      const {
        company,
        site,
        title,
        system,
        time,
        team,
        backgroundColor,
        textColor,
        fontSize,
        start,
        end,

          startTime,
             endTime,
      } = result.value;

      const newEnd = moment(end).add(1, "days");
      const newEvent = {
        company,
        site,
        title,
        system,
        time,
        team, // ✅ เพิ่มตรงนี้
        date: arg.dateStr,
        backgroundColor,
        textColor,
        fontSize,
        start,
        end: newEnd.format("YYYY-MM-DD"),

             startTime,
             endTime,
      };

      // ✅ ตรวจสอบและเพิ่ม Customer ใหม่ถ้ายังไม่มี (ไม่ต้องเช็คว่า company ต้องมีค่า)
      const existingCustomer = customers.userCustomers.find(
        (c) => c.cCompany === company && c.cSite === site
      );

      // ✅ เพิ่มแม้ว่า company จะไม่มีค่า (null หรือ "")
      if (!existingCustomer) {
        await CustomerService.AddCustomer({
          cCompany: company ?? "", // ป้องกัน null โดยแทนเป็น string ว่าง
          cSite: site ?? "",
        });
      }

      setEvents((prev) => [...prev, newEvent]);
      await Promise.all([
        saveEventToDB(newEvent),
        !existingCustomer &&
          CustomerService.AddCustomer({
            cCompany: company ?? "",
            cSite: site ?? "",
          }),
      ]);
      setDefaultTextColor(textColor);
      setDefaultBackgroundColor(backgroundColor);
      setDefaultFontSize(fontSize);

      // ✅ โหลดใหม่เฉพาะเมื่อจำเป็น
      await fetchEventsFromDB();
    }
  });
};
