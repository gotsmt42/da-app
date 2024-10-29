import Swal from "sweetalert2";

export const swalLogout = () => {
  return new Promise((resolve, reject) => {

    try {
      Swal.fire({
        title: "Are you sure?",
        text: "You will be logged out",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Logout",
        cancelButtonText: "Cancel",
        confirmButtonColor:"#d33"
      }).then((result) => {
        if (result.isConfirmed) {
    
          resolve({ isConfirmed: true });
   
        } else {
          resolve({ isConfirmed: false });
        }
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
};
