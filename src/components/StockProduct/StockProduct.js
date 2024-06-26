import React, { useEffect, useState } from "react";
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
import { Link } from "react-router-dom";
import { Add, Search } from "@mui/icons-material";

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

  const [stocks, setStocks] = useState([]);

  const [inputStocks, setInputStocks] = useState([
    { productId: "", quantity: 0 },
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setRows(filter);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [filter]);

  useEffect(() => {
    
    fetchData();
    fetchDataStock();
    getUserData();
  }, []);
  
  useEffect(() => {
    const result = stocks.filter((stock) => {
      const productName = stock.productInfo.name.toLowerCase();
      const productType = stock.productInfo.type.toLowerCase();
      const updatedDate = moment(stock.updatedAt).format("DD/MM/YYYY HH:mm");
  
      return (
        productName.includes(search.toLowerCase()) ||
        productType.includes(search.toLowerCase()) ||
        updatedDate.includes(search.toLowerCase())
      );
    });
  
    setFilterStock(result);
  }, [search, stocks]);
  
  useEffect(() => {
    const result = stocks.filter((stock) => {
      const type = stock.productInfo.type.toLowerCase();
  
      return type.includes(typeSearch.toLowerCase());
    });
  
    setSearch("");
    setFilterStock(result);
  }, [typeSearch, stocks]);
  
  useEffect(() => {
    const result = stocks.filter((stock) => {
      const createdDate = moment(stock.createdAt).format("YYYY-MM-DD HH:mm"); // Convert updated date to a localized string
      return createdDate.includes(dateSearch);
    });
    setSearch("");
    setTypeSearch("")
    setFilterStock(result);
  }, [dateSearch, stocks]);
  

  const getUserData = async () => {
    const getUser = await AuthService.getUserData();
    setUser(getUser.user);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await ProductService.getUserProducts();
      const resProducts = res.userProducts;
      setProducts(resProducts);
      setFilter(resProducts);
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
      const resStocks = res.userStock;
      setStocks(resStocks);
      setFilterStock(resStocks);
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
      // Loop through inputStocks to send data row by row
      for (const stock of inputStocks) {
        // Call the API with the data in the current row
        await StockProductService.AddProductStock(stock);
      }

      setInputStocks([{ productId: "", quantity: 0 }]);

      // Call fetchDataStock to load the new product data
      await fetchDataStock();

      // Stop loading
      setLoading(false);

      // Show success message
      Swal.fire({
        title: "Stock Inserted Successfully!",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
    } catch (error) {
      // Show error message
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
    setInputStocks([...inputStocks, { productId: "", quantity: 0 }]);
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
            try {
              await StockProductService.DeleteProductStock(productId);
            } catch (error) {
              console.error("Error deleting product: ", error);
            }
          }
          setSelectedRows([]);
          setToggleCleared(true);
          setExpandedRows({});
          // เรียก fetchDataStock เพื่ออัปเดตข้อมูลหลังจากลบ
          await fetchDataStock();
          await fetchData(); // เพิ่มการเรียก fetchData เพื่ออัปเดตรายการสินค้าทั้งหมด
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
          await StockProductService.DeleteProductStock(rowId);
  
          setSelectedRows([]);
          setToggleCleared(true);
          setExpandedRows({});
          // เรียก fetchDataStock เพื่ออัปเดตข้อมูลหลังจากลบ
          await fetchDataStock();
          await fetchData(); // เพิ่มการเรียก fetchData เพื่ออัปเดตรายการสินค้าทั้งหมด
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
  const uniqueType = [...new Set(products.filter(product => product && product.type).map((tProduct) => tProduct.type))];

  const formatCurrency = (amount) => {
    // Check if amount is valid and numeric
    if (!amount || isNaN(amount)) {
      return ""; // Return empty string if amount is invalid
    }

    // Use Intl.NumberFormat to format amount as currency
    const formatter = new Intl.NumberFormat("en-TH", {
      style: "currency",
      currency: "THB", // Change currency code as needed
      minimumFractionDigits: 2, // Minimum number of fractional digits
    });

    return formatter.format(amount); // Format amount as currency string
  };

  return (
    <>
      <div className="container mb-4">
         
     
        <div className="row">
        <Link
            to={'/product'}
            key="product"
            aria-label="products"
            data-toggle="tooltip"
            data-placement="top"
            title="ดูข้อมูลสินค้า"
            className="btn btn-primary mb-4"
          >
            <Search />
            ดูข้อมูลสินค้าทั้งหมด
          </Link>
          <div className="col-md-12">
            <form onSubmit={addProductStock}>
              {inputStocks.map((inputStock, index) => (
                <div className="row align-items-start mb-3" key={index}>
                  <div className="col-md-1">
                    <p>
                      <strong>{index + 1}</strong>
                    </p>
                  </div>

                  <div className="col-md-3">
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

                  <div className="col-md-3">
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

                  <div className="col-md-2 mt-3 d-flex align-items-end">
                    {index > 0 && (
                      <button
                        type="button"
                        className="btn btn-danger mb-3"
                        onClick={() => removeInputStock(index)}
                      >
                        <FaMinus /> ลบรายการที่ {index + 1}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="col-md-12 mt-5">
                <div className="d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary w-100"
                    onClick={addInputStock}
                  >
                    <FaPlus /> เพิ่มรายการ
                  </button>
                </div>
              </div>
              <div className="col-md-12 mt-3">
                <div className="d-flex justify-content-start mb-3">
                  <button type="submit" className="btn btn-success w-100">
                    <FaSave /> บันทึกสินค้าลงในสต๊อก
                  </button>
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
                        const typeProduct = stocks.find(
                          (stock) => stock.productInfo.type === type
                        );
                        return (
                          <option key={idx} value={type}>
                            {type}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {/* <div className="col-md m-2">
                    <input
                      style={{ cursor: "pointer" }}
                      className="form-control"
                      type="date"
                      value={dateSearch}
                      onChange={(e) => setDateSearch(e.target.value)}
                    />
                  </div> */}
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
                    Type: product.productInfo?.type || "",
                    Name: product.productInfo?.name || "",
                    Price: formatCurrency(parseFloat(product.productInfo?.price?.$numberDecimal)),
                    Quantity: product.quantity,
                    CountingUnit: product.productInfo?.countingUnit || "",
                    CreateAt: product.createdAt,
                    UpdatedAt: product.updatedAt,
                  }))
                : null
            }
            filename={"Stock-products.csv"}
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
