export const getGeneratePDF = async ({
  jsPDF,
  thSarabunFont,
  event,
  moment,
  docNo,
  description,
  subject,
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

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 25;
  const marginRight = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;

const docNumber = `เลขที่เอกสาร: DA-${moment().format("YYYYMMDD")}-${event.extendedProps._id.slice(-5)}`;

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
    `แจ้งแผนงานการเข้าดำเนินการ ${subject}`,
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
    `ให้เข้าดำเนินการ ${subject} ในระหว่างวันที่ ${start} ถึงวันที่ ${end}`,
    "",
    `        บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ขอแจ้งให้ท่านทราบถึงกำหนดการเข้า ${event.title} ระบบ ${event.extendedProps.system}`,
    `ครั้งที่ ${event.extendedProps.time} ซึ่งทางบริษัทฯ มีกำหนดการเข้าดำเนินการในช่วงเวลาดังนี้`,
    "",
    ...descriptionLines.map((line) => `        ${line}`), // ✅ เว้นวรรคตามจริง
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

  // ข้อความท้ายเอกสาร
  const footerY = y + 10;
  doc.setFontSize(14);
  doc.text("ขอแสดงความนับถือ", pageWidth - marginRight, footerY, {
    align: "right",
  });

  // โลโก้ท้าย
  const sigWidth = 28;
  const sigHeight = (logoProps.height / logoProps.width) * sigWidth;
  doc.addImage(
    logo,
    "PNG",
    pageWidth - marginRight - sigWidth,
    footerY + 5,
    sigWidth,
    sigHeight
  );

  // ช่องเซ็นชื่อ
  const boxY = footerY + sigHeight + 15;
  const boxHeight = 40;
  const boxSpacing = 5;
  const boxWidth = (contentWidth - boxSpacing) / 2;

  // ผู้อนุมัติ
  doc.setDrawColor(0);
  // doc.setLineWidth(0.5);
  doc.rect(marginLeft, boxY, boxWidth, boxHeight);
  doc.setFontSize(12);
  doc.text(
    `ลงชื่อผู้รับทราบในนามโครงการ ${event.extendedProps.site}`,
    marginLeft + 5,
    boxY + 8
  );
  doc.setFontSize(11);
  doc.text("ลงชื่อ", marginLeft + 5, boxY + 22);
  doc.line(marginLeft + 25, boxY + 22, marginLeft + boxWidth - 10, boxY + 22);
  doc.setFontSize(11);
  doc.text("วันที่:", marginLeft + 5, boxY + 32);

// 🔹 คำกำกับแทรก
doc.setFontSize(11);
doc.text("/", marginLeft + 38, boxY + 32);
doc.text("/", marginLeft + 53, boxY + 32);

// 🔹 เส้นใต้แต่ละช่อง (ลดความกว้างลงอีกครึ่ง)
doc.setLineWidth(0.2);

// 🔹 ช่องวัน (ลดจาก 8mm → 6mm)
doc.line(marginLeft + 25, boxY + 33, marginLeft + boxWidth - 10, boxY + 33);


  // ผู้รับทราบ
  const rightBoxX = marginLeft + boxWidth + boxSpacing;
  doc.rect(rightBoxX, boxY, boxWidth, boxHeight);
  doc.setFontSize(12);
  doc.text(`ลงชื่อผู้อนุมัติ`, rightBoxX + 5, boxY + 8);
  doc.setFontSize(11);
  doc.text("ลงชื่อ", rightBoxX + 5, boxY + 22);
  doc.line(rightBoxX + 25, boxY + 22, rightBoxX + boxWidth - 10, boxY + 22);
  doc.setFontSize(11);
  doc.text("วันที่:", rightBoxX + 5, boxY + 32);

  doc.text("/", rightBoxX + 38, boxY + 32);
  doc.text("/", rightBoxX + 53, boxY + 32);

  doc.setLineWidth(0.2);
  doc.line(rightBoxX + 25, boxY + 33, rightBoxX + boxWidth - 10, boxY + 33); // ช่องวัน


  // บันทึกไฟล์
  const safeFileName = `ใบแจ้งขอเข้างาน (${subject})`.replace(
    /[\/\\:*?"<>|]/g,
    "_"
  );
  doc.save(`${safeFileName}.pdf`);
};
