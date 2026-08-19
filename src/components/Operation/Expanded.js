import { useMediaQuery } from "@mui/material";
import React from "react";

import moment from "moment";

const Expanded = ({ data, onStatusUpdate, onDocNoUpdate }) => {
  const isMobile = useMediaQuery("(max-width:600px)");



  if (!data) return <div>ไม่พบข้อมูล</div>;

  return (
    <div className="card mb-3">
      <div className="row g-0">
        <div className="col-md-12">
          <div className="card-body text">
            {/* <Box
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
            </Box> */}
            {/* <h5 className="card-title mt-2">
              อ้างอิงเอกสารเลขที่ : {docNo || "ไม่ระบุ"}
            </h5> */}
<h5>

วันที่ : <span></span> 
   <span> 
              {moment(data.start).isSame(
                moment(data.end).clone().subtract(1, "day"),
                "day"
              ) ? (
                <>
                  {moment(data.start).format("DD")}{" "}
                  <span style={{ color: "#888" }}>
                    {moment(data.start).format("MMMM YYYY")}
                  </span>
                </>
              ) : (
                <>
                  {moment(data.start).format("DD")} –{" "}
                  {moment(data.end).clone().subtract(1, "day").format("DD")}{" "}
                  <span style={{ color: "#888" }}>
                    {moment(data.start).format("MMMM YYYY")}
                  </span>
                </>
              )}
            </span>
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
