import React, { useEffect, useState, useRef } from "react";
import StockProductService from "../../services/StockProductService";
import ProductService from "../../services/ProductService";
import AuthService from "../../services/authService";
import Swal from "sweetalert2";

import { CSVLink } from "react-csv";

import { SwalDelete } from "../../functions/Swal";

import DataTableComponent from "../DataTable/DataTableComponent";
import DataTableContextActions from "../DataTable/DataTableContextActions";
import DataTableColumns from "../DataTable/StockProduct/DataTableColumns";
import ExpandedStockProduct from "./ExpandedStockProduct";

import moment from "moment"; // Import moment library for date formatting
import { ThreeDots } from "react-loader-spinner";
import { FaAd, FaFileExcel, FaMinus, FaPlus, FaSave } from "react-icons/fa";
import { Add } from "@mui/icons-material";

const StockProduct = () => {
  const [user, setUser] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [toggleCleared, setToggleCleared] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [dateSearch, setDateSearch] = useState("");

  const [filter, setFilter] = useState([]);
  const [filterStock, setFilterStock] = useState([]);

  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [editedData, setEditedData] = useState({});

  const [stocks, setStocks] = useState([]);

  const [inputStocks, setInputStocks] = useState([
    { productId: "", price: 0, quantity: 0, countingUnit: "EA" },
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setRows(filter);
    }, 1000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    fetchData();
    fetchDataStock();
    getUserData();
  }, []);

  // useEffect(() => {
  //   const result = stocks.filter((product) => {
  //     const productName = product.name.toLowerCase();
  //     const updatedDate = moment(product.updatedAt).format("DD/MM/YYYY HH:mm");

  //     return (
  //       productName.includes(search.toLowerCase()) ||
  //       updatedDate.includes(search.toLowerCase())
  //     );
  //   });

  //   setFilter(result);
  // }, [search, stocks]);

  // useEffect(() => {
  //   const result = stocks.filter((product) => {
  //     const type = product.type.toLowerCase();

  //     return type.includes(typeSearch.toLowerCase());
  //   });
  //   setDateSearch("");
  //   setSearch("");
  //   setFilter(result);
  // }, [typeSearch, stocks]);

  // useEffect(() => {
  //   const result = stocks.filter((product) => {
  //     const createdDate = moment(product.createdAt).format("YYYY-MM-DD HH:mm");
  //     return createdDate.includes(dateSearch);
  //   });

  //   setFilter(result);
  // }, [dateSearch, stocks]);

  const getUserData = async () => {
    const getUser = await AuthService.getUserData();
    setUser(getUser.user);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await ProductService.getUserProducts();
      const products = res.userProducts;
      setProducts(products);
      setFilter(products);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching products:", error);
      setLoading(false);
    }
  };
  const fetchDataStock = async () => {
    setLoading(true);
    try {
      const res = await StockProductService.getUserProductStock();
      const stocks = res.userStock;
      setStocks(stocks);
      setFilterStock(stocks);
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
  const addProductStock = async (e) => {
    setLoading(true);
    e.preventDefault();
    try {
      // วนลูปผ่าน inputStocks เพื่อส่งข้อมูลทีละแถว
      for (const stock of inputStocks) {
        // เรียกใช้งาน API โดยส่งข้อมูลในแถวนั้นๆ
        await StockProductService.AddProductStock(stock);
      }

      // เรียกใช้ fetchDataStock เพื่อโหลดข้อมูลสินค้าใหม่
      await fetchDataStock();

      // หยุดการโหลด
      setLoading(false);

      // แสดงข้อความแจ้งเตือนเมื่อสำเร็จ
      Swal.fire({
        title: "Stock Inserted Successfully!",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
    } catch (error) {
      // แสดงข้อความแจ้งเตือนเมื่อเกิดข้อผิดพลาด
      console.error("Error adding product stock:", error);
      setLoading(false);
    }
  };

  const handleChange = (e, index) => {
    const { name, value } = e.target;
    const newInputStocks = [...inputStocks];
    newInputStocks[index] = { ...newInputStocks[index], [name]: value };
    setInputStocks(newInputStocks);
  };

  const addInputStock = () => {
    setInputStocks([...inputStocks, { productId: "", price: 0, quantity: 0 }]);
  };

  const removeInputStock = (index) => {
    const newInputStocks = [...inputStocks];
    newInputStocks.splice(index, 1);
    setInputStocks(newInputStocks);
  };

  const handleDelete = async () => {
    try {
      await SwalDelete().then(async (result) => {
        if (result.isConfirmed) {
          for (const row of selectedRows) {
            const productId = row._id;
            console.log("ProductID", productId);
            try {
              await StockProductService.DeleteProductStock(productId);
            } catch (error) {
              console.error("Error deleting product: ", error);
            }
          }
          setSelectedRows([]);
          setToggleCleared(true);
          setExpandedRows({});
          await fetchData();

          Swal.fire("Deleted Success!", "", "success");
        }
      });
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleDeleteRow = async (rowId) => {
    try {
      await SwalDelete().then(async (result) => {
        if (result.isConfirmed) {
          await ProductService.DeleteProduct(rowId);

          setSelectedRows([]);
          setToggleCleared(true);
          setExpandedRows({});
          await fetchData();

          Swal.fire("Deleted Success!", "", "success");
        }
      });
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleRowSelected = (state) => {
    setSelectedRows(state.selectedRows);
  };

  const handleRowClicked = (row) => {
    const newRowState = { ...expandedRows };
    newRowState[row._id] = !expandedRows[row._id];
    setExpandedRows(newRowState);
  };

  const sortedData = filterStock.slice().sort((a, b) => {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const uniqueType = [...new Set(products.map((tProduct) => tProduct.type))];

  return (
    <>
      <div className="container mb-4">
        <div className="row">
          <div className="col-md-12">
            <form onSubmit={addProductStock}>
              <div className="row">
                {inputStocks.map((inputStock, index) => (
                  <React.Fragment key={index}>
                    <div className="col-md-12 mt-5">
                      <div className="d-flex justify-content-end ">
                        {index > 0 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => removeInputStock(index)}
                          >
                            <FaMinus /> ลบแถวที่ {index + 1}
                          </button>
                        )}
                      </div>
                    </div>
                    <p >
                      {" "}
                      <strong>{index + 1}</strong>
                    </p>
                    <div className="col-md-12">
                      <label htmlFor="" className="form-label">
                        เลือกสินค้า:{" "}
                      </label>
                      <select
                        className="form-select"
                        name="productId"
                        value={inputStock.productId}
                        onChange={(e) => handleChange(e, index)}
                        required
                      >
                        <option value="" disabled>
                          Select Product
                        </option>
                        {products.map((product) => (
                          <option key={product._id} value={product._id}>
                            [{product.type}] {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-12">
                      <label htmlFor="" className="form-label">
                        ราคา:{" "}
                      </label>

                      <input
                        type="number"
                        className="form-control"
                        placeholder="Price"
                        name="price"
                        value={inputStock.price}
                        onChange={(e) => handleChange(e, index)}
                        required
                      />
                    </div>
                    <div className="col-md-12">
                      <label htmlFor="" className="form-label">
                        จำนวน:{" "}
                      </label>

                      <input
                        type="number"
                        className="form-control"
                        placeholder="Quantity"
                        name="quantity"
                        value={inputStock.quantity}
                        onChange={(e) => handleChange(e, index)}
                        required
                      />
                    </div>

                    <div className="col-md-12">
                      <label htmlFor="" className="form-label">
                        เลือกหน่วยนับสินค้า:{" "}
                      </label>
                      <select
                        className="form-select"
                        name="countingUnit"
                        value={inputStock.countingUnit}
                        onChange={(e) => handleChange(e, index)}
                        required
                      >
                        <option value="" disabled>
                          Select Counting unit
                        </option>
                        <option value="EA">EA</option>
                        <option value="Lot">Lot</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </React.Fragment>
                ))}
                <div className="col-md-12 mt-3">
                  <div className="d-flex justify-content-end ">
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary "
                      onClick={addInputStock}
                    >
                      <FaPlus /> เพิ่มแถว
                    </button>
                  </div>
                </div>
              </div>
              <div className="row mt-3">
                <div className="col">
                  <div className="d-flex justify-content-start mb-3">
                    <button type="submit" className="btn btn-primary">
                      <FaSave /> บันทึกสินค้าลงในสต๊อก
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <hr className="mt-5 mb-5" />
      <DataTableComponent
        title={`${user.username} - Stock Product`}
        columns={DataTableColumns({
          setSelectedRow,
          setEditedData,
          handleDeleteRow,
          setSelectedFile,
        })}
        data={sortedData}
        fixedHeaderScrollHeight="625px"
        selectableRows
        paginationPerPage={5}
        expandableRowsComponent={ExpandedStockProduct}
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
                    <select
                      id="userSelect"
                      className="form-select"
                      value={typeSearch}
                      onChange={(e) => setTypeSearch(e.target.value)}
                    >
                      <option value={""}>Search for type product</option>
                      {uniqueType.map((type, idx) => {
                        // const typeProduct = products.find(
                        //   (product) => product.type === type
                        // );
                        return (
                          <option key={idx} value={type}>
                            {type}
                          </option>
                        );
                      })}
                    </select>
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
          <CSVLink
            key="export-csv"
            data={
              sortedData
                ? sortedData.map((product) => ({
                    Type: product.type,
                    Name: product.name,
                    Price: product.price,
                    Description: product.description,
                    CreateAt: product.createdAt,
                    UpdatedAt: product.updatedAt,
                  }))
                : null
            }
            filename={"products.csv"}
          >
            <button
              aria-label="export Excel"
              data-toggle="tooltip"
              data-placement="top"
              title="สร้าง Excel"
              className="btn btn-success"
            >
              <FaFileExcel />
              สร้าง Excel
            </button>
          </CSVLink>,
        ]}
      />

      {loading && (
        <div className="loading-overlay">
          <ThreeDots type="ThreeDots" color="#007bff" height={50} width={50} />
        </div>
      )}
    </>
  );
};

export default StockProduct;
