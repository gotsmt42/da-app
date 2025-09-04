
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
  moment
}) => {
  const customers = await CustomerService.getCustomers();
  const employees = await AuthService.getAllUserData();
  const employeeList = employees?.allUser || [];

  Swal.fire({
    title: "เพิ่มแผนงานใหม่",
    customClass: "swal-wide",
    // ✅ ฟอร์มเพิ่มแผนงานแบบ 2 คอลัมน์ Responsive
    html: `
      <div class="swal-form-grid">
        <!-- กลุ่มซ้าย-ขวาแบบ 2 คอลัมน์ -->
        <div>
          <label for="eventCompany">ชื่อบริษัท : </label>
          <select id="eventCompany" class="swal2-select">
            <option selected disabled></option>
            ${customers.userCustomers
              .map(
                (customer) =>
                  `<option value="${customer.cCompany}">${customer.cCompany}</option>`
              )
              .join("")}
          </select>
        </div>
    
        <div>
          <label for="eventSite">ชื่อโครงการ : </label>
          <select id="eventSite" class="swal2-select">
            <option selected disabled></option>
            ${customers.userCustomers
              .map(
                (customer) =>
                  `<option value="${customer.cSite}">${customer.cSite}</option>`
              )
              .join("")}
          </select>
        </div>
    
        <div>
          <label for="eventTitle">ประเภทงาน:</label>
          <select id="eventTitle" class="swal2-select">
            <option selected disabled></option>
            <option value="LOCAL">LOCAL</option>
            <option value="PO">PO</option>
            <option value="PM">Preventive Maintenance (PM)</option>
            <option value="Service">Service</option>
            <option value="Training">Training</option>
            <option value="Inspection">Inspection</option>
            <option value="Test & Commissioning">Test & Commissioning</option>
            <option value="สำรวจหน้างาน">สำรวจหน้างาน</option>
            <option value="ตรวจเช็คปัญหา">ตรวจเช็คปัญหา</option>
            <option value="แก้ไขปัญหา">แก้ไขปัญหา</option>
            <option value="สแตนบาย">สแตนบาย</option>
            <option value="เปลี่ยนอุปกรณ์">เปลี่ยนอุปกรณ์</option>
            <option value="ติดตั้งอุปกรณ์">ติดตั้งอุปกรณ์</option>
          </select>
        </div>
    
        <div>
          <label for="eventSystem">ระบบงาน:</label>
          <select id="eventSystem" class="swal2-select">
            <option selected disabled></option>
            <option value="Office">Office</option>
            <option value="Fire Alarm">Fire Alarm</option>
            <option value="CCTV">CCTV</option>
            <option value="Access Control">Access Control</option>
            <option value="Networks">Networks</option>
          </select>
        </div>
    
        <div>
          <label for="eventTime">ครั้งที่:</label>
          <select id="eventTime" class="swal2-select">
            <option selected disabled></option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>


              <div>
          <label for="eventTeam">ทีม : </label>
          <select id="eventTeam" class="swal2-select">
            <option selected disabled></option>
${employeeList
  .map(
    (employee) => `<option value="${employee.fname}">${employee.fname}</option>`
  )
  .join("")}



          </select>
        </div>
    
        <div style="display: none;">
          <label for="fontSize">ขนาดตัวอักษร:</label>
          <select id="fontSize" class="swal2-input">
            ${[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
              .map((size) => `<option value="${size}">${size}</option>`)
              .join("")}
          </select>
        </div>
      </div>
    
      <!-- ส่วนล่างแนวตั้ง -->
      <div class="swal-form-bottom">
     
    
        <div>
          <label for="backgroundColorPicker">สีพื้นหลัง:</label>
          <input id="backgroundColorPicker" style="width: 150px; height: 35px" type="color" value="${defaultBackgroundColor}" />
        </div><br>
       <div>
          <label for="textColorPicker">สีข้อความ:</label>
          <input id="textColorPicker" style="width: 150; height: 35px" type="color" value="${defaultTextColor}" />
        </div><br>
        
      </div>
      <div>
          <label for="start">เริ่มต้น:</label>
          <input id="start" type="date" style="width: 80%; height: 35px" class="swal2-input" value="${
            arg.dateStr
          }" />
        </div>
    
        <div>
          <label for="end">สิ้นสุด:</label>
          <input id="end" type="date" style="width: 80%; height: 35px" class="swal2-input" value="${
            arg.dateStr
          }" />
        </div>
    `,

    showCancelButton: true,
    confirmButtonText: "บันทึกแผนงาน",
    cancelButtonText: "ยกเลิก",
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
      const start = document.getElementById("start").value;
      const end = document.getElementById("end").value;
      const company = document.getElementById("eventCompany").value;
      const site = document.getElementById("eventSite").value;
      const title = document.getElementById("eventTitle").value;
      const system = document.getElementById("eventSystem").value;
      const time = document.getElementById("eventTime").value;
      const team = document.getElementById("eventTeam").value;

      const backgroundColor = document.getElementById(
        "backgroundColorPicker"
      ).value;
      const textColor = document.getElementById("textColorPicker").value;
      const fontSize = document.getElementById("fontSize").value;
      if (!site) {
        Swal.showValidationMessage("กรุณาระบุโครงการ");
      }
      if (!title) {
        Swal.showValidationMessage("กรุณาระบุหัวข้อ");
      }

      return {
        company: company || "", // ✅ ถ้าไม่กรอก ให้เป็น string ว่าง
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

      setEvents([...events, newEvent]); // อัปเดต state ของ FullCalendar
      await saveEventToDB(newEvent); // บันทึกแผนงานลงฐานข้อมูล
      setDefaultTextColor(textColor);
      setDefaultBackgroundColor(backgroundColor);
      setDefaultFontSize(fontSize);
      await fetchEventsFromDB(); // โหลดข้อมูลแผนงานใหม่จากฐานข้อมูล
    }
  });
};
