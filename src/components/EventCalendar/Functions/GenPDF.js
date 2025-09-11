export const getGeneratePDF = async ({
  jsPDF,
  thSarabunFont,
  event,
  moment,
  description,
}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "A4",
  });
  doc.addFileToVFS("THSarabun.ttf", thSarabunFont);
  doc.addFont("THSarabun.ttf", "THSarabun", "normal");
  doc.setFont("THSarabun");
  doc.setFontSize(16);

  const docNumber = `เลขที่เอกสาร: DA-${moment().format("YYYYMMDD")}-${
    event.extendedProps.time || "01"
  }`;
  doc.setFontSize(12);

  // 🔁 วางข้อความไว้กลางกรอบ
  doc.text(docNumber, 182.5, 8, { align: "center" }); // X = กึ่งกลางกรอบ, Y = กลางแนวตั้ง

  // 🔲 วาดกรอบ
  doc.setDrawColor(155);
  doc.setLineWidth(0.2);
  doc.rect(160, 3, 45, 8); // X, Y, Width, Height

  const timeText = event.extendedProps.time
    ? `ครั้งที่ ${event.extendedProps.time} `
    : "";

  const siteCompany = event.extendedProps.company
    ? `${event.extendedProps.company} `
    : `โครงการ ${event.extendedProps.site} `;

  const logo = "logo-light-2.png";
  const logoProps = doc.getImageProperties(logo);
  const logoWidth = 42; // ใหญ่ขึ้นเพื่อให้เด่น
  const logoHeight = (logoProps.height / logoProps.width) * logoWidth;
  doc.addImage(logo, "PNG", 15, 3, logoWidth, logoHeight); // X=20, Y=12

  doc.setFontSize(20);
  doc.text("บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด", 110, 20, {
    align: "center",
  });

  doc.setFontSize(14);
  doc.text("DO ALL ARCHITECT AND ENGINEERING CO.,LTD.", 110, 27, {
    align: "center",
  });

  doc.setFontSize(12);
  doc.text(
    "68/155 หมู่ 3 ถนนชัยพฤกษ์ ตำบลคลองพระอุดม อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
    110,
    34,
    { align: "center" }
  );

  doc.text("วันที่: " + moment().format("DD-MM-YYYY"), 190, 44, {
    align: "right",
  });
  doc.text("อ้างอิงเอกสารเลขที่: " + event.extendedProps.docNo, 18, 45, {
    align: "left",
  });

    // 🔲 วาดกรอบ
  doc.setDrawColor(155);
  doc.setLineWidth(0.2);
  doc.rect(15, 40, 65, 7); // X, Y, Width, Height

  doc.line(15, 48, 195, 48);

  doc.setFontSize(16);
  doc.text(
    `แจ้งแผนงานการเข้าดำเนินการ ${event.title} ระบบ ${event.extendedProps.system} ${timeText}`,
    105,
    58,
    { align: "center" }
  );

  const start = moment(event.start).format("DD-MM-YYYY");
  const end = moment(event.end).format("DD-MM-YYYY");
const descriptionLines = (description || "").split("\n");
const lines = [
  "",
  `เรียน  ผู้จัดการโครงการ ${event.extendedProps.site}`,
  "",
  `        ตามที่บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ได้รับความไว้วางใจจาก ${siteCompany} `,
  `ให้เข้าดำเนินการ ${event.title} ระบบ ${event.extendedProps.system} ${timeText} ในระหว่างวันที่ ${start} ถึงวันที่ ${end}`,
  "",
  `        บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ขอแจ้งให้ท่านทราบถึงกำหนดการเข้า ${event.title} ระบบ ${event.extendedProps.system}`,
  `ครั้งที่ ${event.extendedProps.time} ซึ่งทางบริษัทฯ มีกำหนดการเข้าดำเนินการในช่วงเวลาดังนี้`,
  "",
  ...descriptionLines.map(line => `        ${line}`), // ✅ เว้นวรรคตามจริง
  "",
  "        ดังนั้น บริษัท ฯ ใคร่ขอความร่วมมือ แจ้งผู้เกี่ยวข้องทุกท่านเพื่อทราบกำหนดการดังกล่าว ทั้งนี้บริษัทจะเข้าดำเนินการโดยไม่ส่งผลกระทบ",
  "ต่อผู้ใช้งานพื้นที่พร้อมมีมาตรการความปลอดภัยตามมาตรฐาน หากท่านไม่สะดวกในการดำเนินการตามวันเวลาดังกล่าวกรุณาแจ้งกลับที่",
  "บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ด้วย จักขอบพระคุณยิ่ง ",
];


  doc.setFontSize(14);
  let y = 68;
  lines.forEach((line) => {
    doc.text(line, 25, y); // ✅ X=25 ให้ห่างขอบซ้าย
    y += 8;
  });

  const signature = "logo-light-2.png";
  const sigWidth = 32;
  const sigHeight = (logoProps.height / logoProps.width) * sigWidth;
  doc.addImage(signature, "PNG", 140, y + 10, sigWidth, sigHeight);

  doc.text("ขอแสดงความนับถือ", 145, y + 40);

  const safeFileName = `ใบแจ้งขอเข้างาน (${event.title}) ${event.extendedProps.system} ${siteCompany} ${timeText}`
  .replace(/[\/\\:*?"<>|]/g, "_");

doc.save(`${safeFileName}.pdf`);

};
