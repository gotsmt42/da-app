import React, { useEffect, useState } from "react";
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
            <label>Type : </label>
            <select
              name="type"
              className="form-select mt-1 mb-2"
              // defaultValue={form.type}
              value={editedData.type}

              onChange={(e) =>
                setEditedData({ ...editedData, type: e.target.value })
              }            >
              <option selected disabled>
                Select type product
              </option>
              <option selected disabled>
              {editedData.type}
              </option>
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
     \
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
