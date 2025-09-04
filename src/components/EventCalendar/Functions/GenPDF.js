export const getGeneratePDF = async ({
  jsPDF,
  thSarabunFont,
  event,
  moment,
}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "A4",
  });

  const timeText = event.extendedProps.time
    ? `ครั้งที่ ${event.extendedProps.time} `
    : ""; // ถ้าไม่มี time จะไม่แสดงอะไรเลย

  // 👉 ฟอนต์ THSarabun
  doc.addFileToVFS("THSarabun.ttf", thSarabunFont);
  doc.addFont("THSarabun.ttf", "THSarabun", "normal");
  doc.setFont("THSarabun");
  doc.setFontSize(16);

  // 👉 ใส่โลโก้บริษัท (ระบุ base64 หรือ path)
  const logo = "001.png"; // 👈 โลโก้บริษัท
  doc.addImage(logo, "PNG", 15, 10, 30, 30); // x, y, width, height

  // 👉 ข้อมูลหัวจดหมาย
  doc.setFontSize(20);
  doc.text("บริษัท ดู ออล อาร์คิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด", 105, 20, {
    align: "center",
  });

  doc.setFontSize(14);
  doc.text("DO ALL ARCHITECT AND ENGINEERING CO.,LTD.", 105, 28, {
    align: "center",
  });

  doc.setFontSize(12);
  doc.text(
    "68/155 หมู่ 3 ถนนชัยพฤกษ์ ตำบลคลองพระอุดม อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
    105,
    34,
    {
      align: "center",
    }
  );

  doc.text("วันที่: " + moment().format("DD-MM-YYYY"), 170, 44, {
    align: "right",
  });

  doc.line(15, 48, 195, 48); // เส้นคั่น

  // 👉 หัวเรื่อง
  doc.setFontSize(16);
  doc.text(
    `แจ้งแผนงานการเข้าดำเนินการ ${event.title} ระบบ ${event.extendedProps.system} ${timeText}`,
    105,
    58,
    {
      align: "center",
    }
  );

  // 👉 ข้อมูล Event
  const end_o = moment(event.end).format("DD-MM-YYYY");
  const start = moment(event.start).format("DD-MM-YYYY");
  const end = moment(event.end).format("DD-MM-YYYY");

  const lines = [
    "",
    `เรียน  ผู้จัดการโครงการ ${event.extendedProps.site}`,
    "",
    `        ตามที่บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ได้รับความไว้วางใจจาก ${event.extendedProps.company} `,
    `ให้เข้าดำเนินการ ${event.title} ระบบ ${event.extendedProps.system} ${timeText} ณ โครงการ ${event.extendedProps.site}`,
    "",

    `        บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ขอแจ้งให้ท่านทราบถึงกำหนดการเข้า ${event.title} ระบบ ${event.extendedProps.system}`,
    `ครั้งที่ ${event.extendedProps.time} ซึ่งทางบริษัทฯ มีกำหนดการเข้าดำเนินการในช่วงเวลาดังนี้`,

    "",

    `        Description`,

    "",

    "        ดังนั้น บริษัท ฯ ใคร่ขอความร่วมมือ แจ้งผู้เกี่ยวข้องทุกท่านเพื่อทราบกำหนดการดังกล่าว ทั้งนี้บริษัทจะเข้าดำเนินการโดยไม่ส่งผลกระทบ",
    "ต่อผู้ใช้งานพื้นที่พร้อมมีมาตรการความปลอดภัยตามมาตรฐาน หากท่านไม่สะดวกในการดำเนินการตามวันเวลาดังกล่าวกรุณาแจ้งกลับที่",
    "บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ด้วย จักขอบพระคุณยิ่ง ",
  ];

  doc.setFontSize(14);
  let y = 68;
  lines.forEach((line) => {
    doc.text(line, 20, y);
    y += 8;
  });

  // 👉 ลายเซ็น
  const signature = "001.png"; // 👈 ลายเซ็น
  doc.addImage(signature, "PNG", 140, y + 10, 40, 20); // ปรับตำแหน่งตามความเหมาะสม

  doc.text("ขอแสดงความนับถือ", 150, y + 35);
  // doc.text("วิศวกรควบคุมระบบ", 140, y + 45);
  // doc.text("064-111-0988", 140, y + 52);

  // 👉 บันทึก PDF
  doc.save(`WorkPermit_${event.title}.pdf`);
};
