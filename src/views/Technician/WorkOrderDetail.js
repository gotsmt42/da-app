import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import WorkOrderService from "../../services/workOrderService";

export default function WorkOrderDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);

  const fetch = async () => {
    const allJobs = await WorkOrderService.getMyJobs();
    setJob(allJobs.find((j) => j._id === id));
  };

  useEffect(() => {
    fetch();
  }, []);

  const startJob = async () => {
    await WorkOrderService.startJob(id);
    fetch();
  };

  const finishJob = async () => {
    await WorkOrderService.finishJob(id);
    fetch();
  };

  const uploadBefore = async (e) => {
    const file = e.target.files[0];
    await WorkOrderService.uploadImage(id, "before", file);
    fetch();
  };

  const uploadAfter = async (e) => {
    const file = e.target.files[0];
    await WorkOrderService.uploadImage(id, "after", file);
    fetch();
  };

  if (!job) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>{job.title}</h2>
      <p>สถานะ: <b>{job.status}</b></p>

      <button onClick={startJob} disabled={job.status !== "waiting"}>
        ▶ เริ่มงาน
      </button>

      <h3>อัปโหลดรูปก่อนงาน</h3>
      <input type="file" accept="image/*" onChange={uploadBefore} />

      <h3>อัปโหลดรูปหลังงาน</h3>
      <input type="file" accept="image/*" onChange={uploadAfter} />

      <button onClick={finishJob} disabled={job.status !== "in-progress"}>
        ✔ ปิดงาน
      </button>
    </div>
  );
}
