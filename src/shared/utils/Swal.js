import Swal from "sweetalert2";

export const SwalDelete = () => {
  return new Promise((resolve, reject) => {
    try {
      Swal.fire({
        title: "Are you sure?",
        text: "You will be delete",
        icon: "error",
        showCancelButton: true,
        confirmButtonColor: "red",
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
      }).then((result) => {
        if (result.isConfirmed) {
          resolve({ isConfirmed: true });
        } else {
          resolve({ isConfirmed: false }); // ส่งคืนค่า isConfirmed เพื่อระบุว่าผู้ใช้กดปุ่ม Cancel
        }
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
};
