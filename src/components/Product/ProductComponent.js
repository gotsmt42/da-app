/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef } from "react";
import ProductService from "../../services/ProductService";
import TypeProductService from "../../services/TypeProductService";
import AuthService from "../../services/authService";
import Swal from "sweetalert2";

import IconButton from "@mui/material/IconButton";

import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import Add from "@mui/icons-material/Add";

import { CSVLink } from "react-csv";

import { SwalDelete } from "../../functions/Swal";

import DataTableComponent from "../DataTable/DataTableComponent";
import DataTableContextActions from "../DataTable/DataTableContextActions";
import DataTableColumns from "../DataTable/Product/DataTableColumns";
import InsertModal from "../Modal/products/InsertModal";
import EditModal from "../Modal/products/EditModal";

import ExpandedProduct from "./ExpandedProduct";

import moment from "moment"; // Import moment library for date formatting
import { ThreeDots } from "react-loader-spinner";

const ProductComponent = () => {
  const [user, setUser] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [toggleCleared, setToggleCleared] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [dateSearch, setDateSearch] = useState(""); // New state for date search

  const [filter, setFilter] = useState([]);
  const [form, setForm] = useState({
  
    description: "",
    price: 0,
    type: "Type of product",
    image: null,
  });

  useEffect(() => {
    setForm(prevForm => ({
      ...prevForm,
      name:"Product " + (products.length + 1)
    }));
  }, [products]);
  

  // eslint-disable-next-line no-unused-vars
  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [modalOpenInsert, setModalOpenInsert] = useState(false);
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [editedData, setEditedData] = useState({});



  useEffect(() => {
    const timeout = setTimeout(() => {
      setRows(filter);
    }, 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //useEffect for get data
  useEffect(() => {
    fetchData();
    getUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search for products
  useEffect(() => {
    const result = products.filter((product) => {
      const productName = product.name.toLowerCase();
      const updatedDate = moment(product.updatedAt).format("DD/MM/YYYY HH:mm"); // Convert updated date to a localized string

      // Check if the product name or the updated date matches the search term
      return (
        productName.includes(search.toLowerCase()) ||
        updatedDate.includes(search.toLowerCase())
      );
    });

    setFilter(result);
  }, [search, products]);

  //useEffect hook for date search
  useEffect(() => {
    const result = products.filter((product) => {
      const createdDate = moment(product.createdAt).format("YYYY-MM-DD HH:mm"); // Convert updated date to a localized string
      return createdDate.includes(dateSearch);
    });

    setFilter(result);
  }, [dateSearch, products]);

  //ฟังชั่น get ข้อมูล User ที่ login ตาม jwt
  const getUserData = async () => {
    const getUser = await AuthService.getUserData();
    setUser(getUser.user);
  };

  //ฟังชั่น get ข้อมูล User Data มาแสดงทั้งหมด
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await ProductService.getUserProducts();
      const products = res.userProducts;
      setProducts(products);
      setFilter(products);
      setSelectedRows([]);
      setToggleCleared(false);
      setExpandedRows({});
      setSearch("");
      setDateSearch("");
      setRows([]);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching products:", error);
      setLoading(false);
    }
  };

  //ฟังชั่นเพิ่มข้อมูลใหม่
  const addProduct = async (e) => {
    setLoading(true)
    e.preventDefault();
    const formData = new FormData();
    for (const [key, value] of Object.entries(form)) {
      formData.append(key, value);
    }
    try {
      await ProductService.AddProduct(formData).then(async() => {
        setForm({
          name: form.name,
          description: form.description,
          price: 0,
          type: form.type,
          image: null,
        });
        setModalOpenInsert(false);
        setSelectedFile(null);
        setExpandedRows({});
        await fetchData();
        setLoading(false)
        Swal.fire({
          title: "Inserted Success!",
          icon: "success",
          timer: 1000,
          showConfirmButton: false,
        });
      });
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  //ฟังชั่น Input Data ให้เข้าไปเก็บใน state
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  //ฟังชั่นเลือก File Input ให้เข้าไปเก็บไว้ใน state
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setForm({
      ...form,
      [e.target.name]: e.target.files[0],
    });
  };

  //ฟังชั่นแก้ไข File Image
  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  //ฟังชั่นแก้ไขข้อมูล
  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const productId = selectedRow._id;
      const formData = new FormData();
      for (const [key, value] of Object.entries(editedData)) {
        formData.append(key, value);
      }
      if (selectedFile) {
        formData.append("image", selectedFile);
      }
      const response = await ProductService.UpdateProduct(productId, formData);
      const updatedData = products.map((item) =>
        item._id === selectedRow._id ? { ...item, ...response.data } : item
      );
      setProducts(updatedData);
      setModalOpenEdit(false);
      setSelectedFile(null);
      setSelectedRows([]);
      setToggleCleared(true);
      await fetchData();

      Swal.fire("Updeated Success!", "", "success");
    } catch (error) {
      console.error("Error updating data:", error);
    }
  };

  //ฟังชั่นลบข้อมูลที่ Select ทั้งหมด
  const handleDelete = async () => {
    try {
      await SwalDelete().then(async (result) => {
        if (result.isConfirmed) {
          for (const row of selectedRows) {
            const productId = row._id;
            console.log("ProductID", productId);
            try {
              await ProductService.DeleteProduct(productId);
              // หลังจากลบสินค้าเรียบร้อยแล้ว คุณอาจต้องรีเฟรชข้อมูลโดยใช้ fetchData()
            } catch (error) {
              console.error("Error deleting product: ", error);
            }
          }
          setSelectedRows([]); // เคลียร์รายการที่ถูกเลือก
          setToggleCleared(true); // ตั้งค่าให้เคลียร์รายการที่ถูกเลือก
          setExpandedRows({}); // ล้างข้อมูลการขยายแถว
          await fetchData(); // รีเฟรชข้อมูลหลังจากลบสินค้าเรียบร้อยแล้ว

          Swal.fire("Deleted Success!", "", "success");
        }
      });
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  //ฟังชั่นลบข้อมูลทีละแถวที่มีส่งมาจาก DataTableColumns
  const handleDeleteRow = async (rowId) => {
    try {
      await SwalDelete().then(async (result) => {
        if (result.isConfirmed) {
          await ProductService.DeleteProduct(rowId);

          setSelectedRows([]); // เคลียร์รายการที่ถูกเลือก
          setToggleCleared(true); // ตั้งค่าให้เคลียร์รายการที่ถูกเลือก
          setExpandedRows({}); // ล้างข้อมูลการขยายแถว
          await fetchData(); // รีเฟรชข้อมูลหลังจากลบสินค้าเรียบร้อยแล้ว

          Swal.fire("Deleted Success!", "", "success");
        }
      });
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const fileInputRef = useRef(null);

  //Select ข้อมูลในแถวเก็บไว้ใน state
  const handleRowSelected = (state) => {
    setSelectedRows(state.selectedRows);
  };

  const handleRowClicked = (row) => {
    const newRowState = { ...expandedRows };
    newRowState[row._id] = !expandedRows[row._id];
    setExpandedRows(newRowState);
  };

  //Sort ข้อมูลให้เรียงลำดับใหม่
  const sortedData = filter.slice().sort((a, b) => {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const handleCloseModalEdit = () => {
    setModalOpenEdit(false);
    setSelectedFile(null);
  };
  const handleCloseModalInsert = () => {
    setModalOpenInsert(false);
    setSelectedFile(null);
  };

  return (
    <>
      <DataTableComponent
        title={`${user.username} - Product`}
        columns={DataTableColumns({
          setSelectedRow,
          setEditedData,
          setModalOpenEdit,
          handleDeleteRow,
          setSelectedFile,
        })}
        data={sortedData}
        fixedHeaderScrollHeight="625px"
        paginationPerPage={5}
        expandableRowsComponent={ExpandedProduct} // เปิดใช้งาน Expandle
        expandableRowExpanded={(row) => expandedRows[row._id]}
        onRowClicked={handleRowClicked}
        onSelectedRowsChange={handleRowSelected}
        clearSelectedRows={toggleCleared}
        subHeaderComponent={
          <div className="container">
            <div className="row">
              <div className="col-md-12">
                <div className="row g-0">
                  <div className="col-md m-2">
                    <input
                      className="form-control"
                      type="search"
                      placeholder="Search here"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="col-md m-2">
                    <input
                      style={{ cursor: "pointer" }}
                      className="form-control"
                      type="date"
                      value={dateSearch}
                      onChange={(e) => setDateSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
        contextActions={<DataTableContextActions handleDelete={handleDelete} />}
        actions={[
          <CSVLink key="export-csv" data={products} filename={"products.csv"}>
            <IconButton
              aria-label="export csv"
              data-toggle="tooltip"
              data-placement="top"
              title="Export CSV"
            >
              <CloudDownloadIcon />
            </IconButton>
          </CSVLink>,

          <IconButton
            key="insert-product"
            onClick={() => {
              setSelectedFile(null);
              setModalOpenInsert(true);
            }}
            aria-label="Insert products"
            data-toggle="tooltip"
            data-placement="top"
            title="เพิ่มข้อมูลสินค้าใหม่"
          >
            <Add />
          </IconButton>,
        ]}
      />

      {loading && (
        <div className="loading-overlay">
          <ThreeDots type="ThreeDots" color="#007bff" height={50} width={50} />
        </div>
      )}

      <InsertModal
        show={modalOpenInsert}
        handleClose={handleCloseModalInsert}
        handleSubmit={addProduct}
        handleChange={handleChange}
        handleFileChange={handleFileChange}
        fileInputRef={fileInputRef}
        selectedFile={selectedFile}
        setModalOpenInsert={setModalOpenInsert}
        form={form}
        setForm={setForm}
        setSelectedFile={setSelectedFile}
      />

      <EditModal
        show={modalOpenEdit}
        handleClose={handleCloseModalEdit}
        handleSubmit={handleEdit}
        handleEditFileChange={handleEditFileChange}
        editedData={editedData}
        selectedFile={selectedFile}
        setEditedData={setEditedData}
        setSelectedFile={setSelectedFile}
        setModalOpenEdit={setModalOpenEdit}
      />
    </>
  );
};

export default ProductComponent;
