import React from "react";
import { Button } from "react-bootstrap";
import API from "@/shared/api/axiosInstance";

import {
  MDBBtn,
  MDBModal,
  MDBModalDialog,
  MDBModalContent,
  MDBModalHeader,
  MDBModalTitle,
  MDBModalBody,
  MDBModalFooter,
} from "mdb-react-ui-kit";

/** ประเภทสินค้ามาตรฐาน — ใช้เช็คว่าค่าเดิมของสินค้ายังอยู่ในรายการนี้ไหม */
const TYPE_OPTIONS = [
  "Smoke ADD",
  "Smoke Conven",
  "Heat ADD",
  "Heat Conven",
  "Base",
  "Sounder Base",
  "Module",
  "Manual Station",
  "Speaker & Strobe",
  "Horn & Strobe",
  "Other",
];

/** หน่วยนับสินค้า */
const UNIT_OPTIONS = ["EA", "Lot", "Other"];

const EditProductModal = ({
  show,
  handleClose,
  handleSubmit,
  handleEditFileChange,
  editedData,
  selectedFile,
  setEditedData,
  setModalOpenEdit,
}) => {
  return (
    <>
      <MDBModal
        open={show}
        onClose={() => {
          setModalOpenEdit(false);
        }}
        tabIndex="-1"
      >
        <MDBModalDialog scrollable>
          <MDBModalContent>
            <MDBModalHeader>
              <MDBModalTitle>Edit Product</MDBModalTitle>
              <MDBBtn
                className="btn-close"
                color="none"
                onClick={handleClose}
              ></MDBBtn>
            </MDBModalHeader>
            <MDBModalBody>
              <label>Type : </label>
              <select
                name="type"
                className="form-select mt-1 mb-2"
                value={editedData.type}
                onChange={(e) =>
                  setEditedData({ ...editedData, type: e.target.value })
                }
              >
                {/* ⚠️ ห้ามใช้ selected บน <option> ใน React — ค่าที่เลือกอยู่ที่ value ของ <select> แล้ว */}
                <option value="" disabled>
                  Select type product
                </option>
                {/* ✅ ของเก่าที่ประเภทไม่มีในรายการนี้แล้ว ต้องยังเห็นค่าเดิม ไม่ใช่ช่องว่าง
                    (ไม่งั้นแค่เปิดมาแก้ชื่อ ประเภทจะหายไปเงียบๆ ตอนกดบันทึก) */}
                {editedData.type && !TYPE_OPTIONS.includes(editedData.type) && (
                  <option value={editedData.type}>{editedData.type}</option>
                )}
                <option value="Smoke ADD">Smoke ADD</option>
                <option value="Smoke Conven">Smoke Conven</option>
                <option value="Heat ADD">Heat ADD</option>
                <option value="Heat Conven">Heat Conven</option>
                <option value="Base">Base</option>
                <option value="Sounder Base">Sounder Base</option>
                <option value="Module">Module</option>
                <option value="Manual Station">Manual Station</option>
                <option value="Speaker & Strobe">Speaker & Strobe</option>
                <option value="Horn & Strobe">Horn & Strobe</option>
                <option value="Other">Other</option>
              </select>
              <label>Name:</label>
              <input
                type="text"
                className="form-control"
                value={editedData.name}
                onChange={(e) =>
                  setEditedData({ ...editedData, name: e.target.value })
                }
              />
              <label>Price:</label>
              <input
                type="number"
                value={editedData.price}
                className="form-control mt-1 mb-2"
                onChange={(e) =>
                  setEditedData({...editedData,price: e.target.value })
                }
              />
              <label>เลือกหน่วยนับสินค้า:</label>
              <select
                className="form-select"
                value={editedData.countingUnit}
                onChange={(e) =>
                  setEditedData({ ...editedData, countingUnit: e.target.value })
                }
                required
              >
                <option value="" disabled>
                  Select Counting unit
                </option>
                {editedData.countingUnit && !UNIT_OPTIONS.includes(editedData.countingUnit) && (
                  <option value={editedData.countingUnit}>{editedData.countingUnit}</option>
                )}
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>

              <label>Description:</label>
              <textarea
                type="text"
                className="form-control"
                as="textarea"
                aria-label="With textarea"
                rows="4"
                cols="50"
                value={editedData.description}
                onChange={(e) =>
                  setEditedData({ ...editedData, description: e.target.value })
                }
              />
              <label>Image:</label>
              <input
                type="file"
                className="form-control"
                onChange={handleEditFileChange}
              />
              <img
                className="mt-2 img-preview img-thumbnail img-fluid"
                src={
                  selectedFile
                    ? URL.createObjectURL(selectedFile)
                    : `${API.defaults.baseURL}/${editedData.imageUrl}`
                }
                alt=""
              />
            </MDBModalBody>
            <MDBModalFooter>
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleSubmit}>Save changes</Button>
            </MDBModalFooter>
          </MDBModalContent>
        </MDBModalDialog>
      </MDBModal>
    </>
  );
};

export default EditProductModal;
