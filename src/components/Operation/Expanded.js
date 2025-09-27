import { useMediaQuery } from "@mui/material";
import StatusSelectCell from "../DataTable/TblOperation/StatusSelectCell";
import StatusThreeSelectCell from "../DataTable/TblOperation/StatusThreeSelectCell";
import StatusTwoSelectCell from "../DataTable/TblOperation/StatusTwoSelectCell";
import React, { useState, useEffect } from "react";
import EventService from "../../services/EventService"; // 👈 สำหรับอัปเดตข้อมูล
import { TextField, Box, CircularProgress } from "@mui/material";
import Swal from "sweetalert2";
const Expanded = ({ data, onStatusUpdate, onDocNoUpdate }) => {
  const isMobile = useMediaQuery("(max-width:600px)");

  const [docNo, setDocNo] = useState(data.docNo || "");
  const [loading, setLoading] = useState(false);
  const [initialDocNo, setInitialDocNo] = useState(data.docNo || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDocNo(data.docNo || "");
    setInitialDocNo(data.docNo || "");
  }, [data]);

  const handleAutoUpdate = async () => {
    if (docNo === initialDocNo) return;

    try {
      setLoading(true);

      const updated = await EventService.UpdateEvent(data._id, {
        ...data,
        docNo,
      });

      setInitialDocNo(docNo);

      // 🟢 อัปเดตแสดงผลในตารางด้วย
      if (onStatusUpdate) {
        onStatusUpdate(data._id, docNo); // 👉 ส่ง id และ docNo ใหม่
      }

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "บันทึกแล้ว",
        showConfirmButton: false,
        timer: 1200,
      });
    } catch (err) {
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกเลขที่เอกสารได้", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!data) return <div>ไม่พบข้อมูล</div>;

  return (
    <div className="card mb-3">
      <div className="row g-0">
        <div className="col-md-12">
          <div className="card-body text">
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap", // ✅ สำหรับหน้าจอเล็ก
                mb: 1,
              }}
            >
              {" "}
              <TextField
                label="เลขที่เอกสาร (docNo)"
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                onBlur={handleAutoUpdate} // ✅ อัปเดตอัตโนมัติเมื่อออกจากช่อง
                size="small"
                fullWidth
                sx={{ maxWidth: 350, mb: 1 }}
              />
              {loading && <CircularProgress size={20} />}
            </Box>
            <h5 className="card-title mt-4">
              อ้างอิงเอกสารเลขที่ : {docNo || "ไม่ระบุ"}
            </h5>

            <p></p>

            <p className="card-text">
              บริษัท / นิติบุคคล : {data.company || "ไม่ระบุ"}
            </p>
            <p></p>
            <p className="card-text">
              งาน / โครงการ : [{data.title}] {data.system} ครั้งที่{" "}
              {data.time || "ไม่ระบุ"} - {data.site}
            </p>

            {/* ✅ ปรับ layout พร้อม label */}

            {isMobile && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "1rem",
                  width: "80%",
                  maxWidth: "400px", // ✅ จำกัดความกว้างไม่ให้ยืดเกินไป
                }}
              >
                {/* <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <label>การดำเนินการ : </label>
                  <StatusSelectCell
                    row={data}
                    onStatusUpdate={onStatusUpdate}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <label>สถานะ 1 : </label>
                  <StatusTwoSelectCell
                    row={data}
                    onStatusUpdate={onStatusUpdate}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <label>สถานะ 2 : </label>
                  <StatusThreeSelectCell
                    row={data}
                    onStatusUpdate={onStatusUpdate}
                  />
                </div> */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expanded;
