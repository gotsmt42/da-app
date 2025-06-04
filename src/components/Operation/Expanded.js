import { useMediaQuery } from "@mui/material";
import StatusSelectCell from "../DataTable/TblOperation/StatusSelectCell";
import StatusThreeSelectCell from "../DataTable/TblOperation/StatusThreeSelectCell";
import StatusTwoSelectCell from "../DataTable/TblOperation/StatusTwoSelectCell";

const Expanded = ({ data, onStatusUpdate }) => {

        const isMobile = useMediaQuery("(max-width:600px)");

  if (!data) return <div>ไม่พบข้อมูล</div>;



  return (
    <div className="card mb-3">
      <div className="row g-0">
        <div className="col-md-12">
          <div className="card-body text">
            <h5 className="card-title">
              อ้างอิงเอกสารเลขที่ : {data.docNo || "ไม่ระบุ"}
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
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label >การดำเนินการ : </label>
                <StatusSelectCell row={data} onStatusUpdate={onStatusUpdate} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label >สถานะ 1 : </label>
                <StatusTwoSelectCell row={data} onStatusUpdate={onStatusUpdate} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label >สถานะ 2 : </label>
                <StatusThreeSelectCell row={data} onStatusUpdate={onStatusUpdate} />
              </div>
            </div>
              )}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Expanded;
