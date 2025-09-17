import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

const CheckConnectionToast = ({ children }) => {
  const offlineToastId = useRef(null);

  useEffect(() => {
    const showOfflineToast = () => {
      if (!offlineToastId.current) {
        offlineToastId.current = toast.error("ไม่มีการเชื่อมต่ออินเทอร์เน็ต", {
          autoClose: false,
          closeOnClick: false,
          draggable: false,
          closeButton: false,
          hideProgressBar: true,
        });
      }
    };

    const dismissOfflineToast = () => {
      if (offlineToastId.current) {
        toast.dismiss(offlineToastId.current);
        offlineToastId.current = null;
        toast.success("กลับมาเชื่อมต่อแล้ว", { autoClose: 2000 });
      }
    };

    const handleOnline = () => dismissOfflineToast();
    const handleOffline = () => showOfflineToast();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // ✅ ตรวจทันทีตอน mount (รองรับ refresh ตอน offline)
    if (!navigator.onLine) {
      setTimeout(showOfflineToast, 50); // รอ ToastContainer render ก่อน
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (offlineToastId.current) toast.dismiss(offlineToastId.current);
    };
  }, []);

  return children;
};

export default CheckConnectionToast;
