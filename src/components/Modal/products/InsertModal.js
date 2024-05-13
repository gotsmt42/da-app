// InsertProductModal.jsx
import { Modal, Button } from "react-bootstrap";
import API from "../../../API/axiosInstance";

import TypeProductService from "../../../services/TypeProductService";

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
}) => {
  const [types, setTypes] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await TypeProductService.getUserTypeProducts();
        setTypes(res.userTypeProducts);
      } catch (error) {
        console.error("Error fetching type product:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <MDBModal
      open={show}
      onClose={() => {
        setSelectedFile(null);
        setModalOpenInsert(false);
      }}
      tabIndex="-1"
    >
      <MDBModalDialog scrollable>
        <MDBModalContent>
          <MDBModalHeader>
            <MDBModalTitle>Insert Product</MDBModalTitle>
            <MDBBtn
              className="btn-close"
              color="none"
              onClick={handleClose}
            ></MDBBtn>
          </MDBModalHeader>
          <MDBModalBody className="m-2">
            <label>Type : </label>
            <select
              name="type"
              className="form-select mt-1 mb-2"
              onChange={handleChange}
            >
                    <option selected disabled>Select type product</option>

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
              {types &&
                Array.isArray(types) &&
                types.map((type, idx) => {
                  return (
                    <option key={idx} value={type}>
                      {type.type}
                    </option>
                  );
                })}
              <option value="Other">Other</option>
            </select>
            <label>Name:</label>
            <input
              type="text"
              name="name"
              className="form-control mt-1 mb-2"
              onChange={handleChange}
            />
            <label>Price : </label>
            <input
              type="number"
              name="price"
              className="form-control mt-1 mb-2"
              onChange={handleChange}
            />
            <label>Description : </label>
            <textarea
              type="text"
              name="description"
              className="form-control mt-1 mb-2"
              as="textarea"
              aria-label="With textarea"
              rows="4"
              cols="50"
              onChange={handleChange}
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
                  : `${API.defaults.baseURL}/${form.imageUrl}`
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
  );
};

export default InsertProductModal;
