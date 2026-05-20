import { useEffect, useState } from "react";
import WorkOrderService from "../../services/workOrderService";

export default function MyJobs() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    WorkOrderService.getMyJobs().then((data) => setJobs(data));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>งานที่ได้รับมอบหมาย</h2>

      {jobs.map((job) => (
        <div key={job._id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
          <h3>{job.title}</h3>
          <p>{job.site}</p>
          <p>สถานะงาน: <b>{job.status}</b></p>

          <a href={`/technician/job/${job._id}`}>
            <button>เปิดดูงาน</button>
          </a>
        </div>
      ))}
    </div>
  );
}
