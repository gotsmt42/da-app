import CustomerService from "../../../services/CustomerService";
import EventService from "../../../services/EventService";
import EventReceiveService from "../../../services/EventReceiveService"; // eventDialog.js
import AuthService from "../../../services/authService";
import Swal from "sweetalert2";
import TomSelect from "tom-select";
import moment from "moment";

export const getSaveEventToDB = async ({
  newEvent
}) => {
    try {
      // ✅ ตรวจสอบว่ามี start, end, และ date ครบถ้วน
      if (!newEvent.start || !newEvent.end || !newEvent.date) {
        console.error("❌ Missing required fields:", newEvent);
        throw new Error("Missing required fields: start, end, or date");
      }

      // console.log("🔍 Sending data to API:", JSON.stringify(newEvent, null, 2));

      const response = await EventService.AddEvent(newEvent);

      return response;
    } catch (error) {
      console.error("❌ Error saving event to DB:", error.message);
      throw error;
    }
};
