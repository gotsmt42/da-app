// InsertProductModal.jsx
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
  return (
    <MDBModal
    open={show}
    onClose={() =>{
      setSelectedFile(null)
      setModalOpenInsert(false)    
    } }
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
        <MDBModalBody>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            className="form-control"
            onChange={handleChange}
          />
          <label>Price:</label>
          <input
            type="number"
            name="price"
            className="form-control"
            onChange={handleChange }
          />
          <label>Description:</label>
          <textarea
            type="text"
            name="description"
            className="form-control"
            as="textarea"
            aria-label="With textarea"
            rows="4"
            cols="50"
            onChange={handleChange }
          />
          <label>Image:</label>
          <input
            type="file"
            className="form-control"
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