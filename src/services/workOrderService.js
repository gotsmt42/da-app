import API from "../API/axiosInstance";
import AuthService from "./authService";

const WorkOrderService = {
  async getMyJobs() {
    const user = await AuthService.getUserData();
    if (!user) return [];

    const res = await API.get(`/workorder/my-jobs/${user.userId}`);
    return res.data.jobs;
  },

  async startJob(workOrderId) {
    const res = await API.patch(`/workorder/${workOrderId}/start`);
    return res.data.job;
  },

  async finishJob(workOrderId) {
    const res = await API.patch(`/workorder/${workOrderId}/finish`);
    return res.data.job;
  },

  async uploadImage(workOrderId, type, file) {
    const formData = new FormData();
    formData.append("image", file);

    const res = await API.post(
      `/workorder/${workOrderId}/upload/${type}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );

    return res.data;
  },
};

export default WorkOrderService;
