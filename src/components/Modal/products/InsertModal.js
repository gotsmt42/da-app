import { Modal, Button } from "react-bootstrap";
import API from "../../../API/axiosInstance";
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
import { useEffect, useState } from "react";
import ProductService from "../../../services/ProductService";

const InsertProductModal = ({
  show,
  handleClose,
  handleSubmit,
  handleChange,
  handleFileChange,
  fileInputRef,
  selectedFile,
  setModalOpenInsert,
  setSelectedFile,
  form,
  setForm, // Adding setForm to manage the form state
}) => {
  // const [types, setTypes] = useState([]);
  // const [selectedType, setSelectedType] = useState(form.type); // Default to form.type

  // useEffect(() => {
  //   const fetchData = async () => {
  //     try {
  //       const res = await ProductService.getUserProducts();
  //       setTypes(res.userProducts);
  //     } catch (error) {
  //       console.error("Error fetching type product:", error);
  //     }
  //   };

  //   fetchData();
  // }, []);

  // useEffect(() => {
  //   setSelectedType(form.type || ""); // Reset selectedType when form.type changes
  // }, [form.type]);

  const handleTypeChange = (e) => {
    setForm({ ...form, type: e.target.value });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleModalClose = () => {
    setSelectedFile(null);
    setModalOpenInsert(false);
    handleClose();
  };

  return (
    <MDBModal open={show} onClose={handleModalClose} tabIndex="-1">
      <MDBModalDialog scrollable>
        <MDBModalContent>
          <MDBModalHeader>
            <MDBModalTitle>Insert Product</MDBModalTitle>
            <MDBBtn
              className="btn-close"
              color="none"
              onClick={handleModalClose}
            ></MDBBtn>
          </MDBModalHeader>
          <MDBModalBody className="m-2">
            <label>Type : </label>
            <select
              name="type"
              className="form-select mt-1 mb-2"
              // defaultValue={form}
              onChange={handleTypeChange}
            >
              <option selected disabled>
                Select type product
              </option>
              <option value="Smoke ADD">Smoke ADD</option>
              <option value="Smoke Conven">Smoke Conven</option>
              <option value="Heat ADD">Heat ADD</option>
              <option value="Heat Conven">Heat Conven</option>
              <option value="Base">Base</option>
              <option value="Sounder Base">Sounder Base</option>
              <option value="Module">Module</option>
              <option value="Manual Station">Manual Station</option>
              <option value="Bell">Bell</option>
              <option value="Speaker & Strobe">Speaker & Strobe</option>
              <option value="Horn & Strobe">Horn & Strobe</option>
              <option value="Horn & Strobe">Horn & Strobe</option>
              <option value="Hardware">Hardware</option>
              {/* {types &&
                Array.isArray(types) &&
                types.map((type, idx) => (
                  <option key={idx} value={type.type}>
                    {type.type}
                  </option>
                ))} */}
              <option value="Other">Other</option>
            </select>
            <label>Name:</label>
            <input
              type="text"
              name="name"
              className="form-control mt-1 mb-2"
              onChange={handleInputChange}
            />
            <label>Price:</label>
            <input
              type="number"
              name="price"
              className="form-control mt-1 mb-2"
              onChange={handleInputChange}
            />
            <label htmlFor="" className="form-label">
              {" "}
              เลือกหน่วยนับสินค้า:
            </label>
            <select
              className="form-select"
              name="countingUnit"
              onChange={handleInputChange}
              required
            >
              <option selected disabled>
                Select Counting unit
              </option>
              <option value="EA">EA</option>
              <option value="Lot">Lot</option>
              <option value="Other">Other</option>
            </select>

            <label>Description : </label>
            <textarea
              name="description"
              className="form-control mt-1 mb-2"
              rows="4"
              onChange={handleInputChange}
            />
            <label>Image : </label>
            <input
              type="file"
              className="form-control mt-1"
              name="image"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <img
              className="mt-2 img-preview img-thumbnail img-fluid"
              src={
                selectedFile
                  ? URL.createObjectURL(selectedFile)
                  : form.imageUrl
                  ? `${API.defaults.baseURL}/${form.imageUrl}`
                  : ""
              }
              alt=""
            />
          </MDBModalBody>
          <MDBModalFooter>
            <Button variant="secondary" onClick={handleModalClose}>
              Close
            </Button>
            <Button onClick={handleSubmit}>Save changes</Button>
          </MDBModalFooter>
        </MDBModalContent>
      </MDBModalDialog>
    </MDBModal>
  );
};

export default InsertProductModal;
