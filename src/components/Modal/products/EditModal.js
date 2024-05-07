import React, { useState } from "react";
import { Button } from "react-bootstrap";
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
                className="form-control"
                value={editedData.price}
                onChange={(e) =>
                  setEditedData({ ...editedData, price: e.target.value })
                }
              />
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
