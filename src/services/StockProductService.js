    // src/services/productService.js
    import API from "../API/axiosInstance";
    import AuthService from "./authService";

    const ProductService = {
    async getUserProductStock() {
        try {
        const userData = await AuthService.getUserData();
        if (userData) {
            const response = await API.get(`/stockproduct`);
            return response.data;
        }
        } catch (error) {
        console.error("Error fetching user stockproduct:", error);
        throw error;
        }
    },

    async AddProductStock(formData) {
        try {
          const userData = await AuthService.getUserData();
          if (userData) {
            const response = await API.post(`/stockproduct`, formData);
            return response.data;
          }
        } catch (error) {
          console.error("Error adding product stock:", error);
          throw error;
        }
      },
      

    //   async ReadProduct(productId) {
    //     try {
    //       const userData = await AuthService.getUserData();
    //       if (userData) {
    //         const response = await API.get(`/product/stock/${productId}`);
    //         return response.data;
    //       }
    //     } catch (error) {
    //       console.error("Error reading product:", error);
    //       throw error;
    //     }
    //   },

    async UpdateProduct(productId, editedData) {
        try {
        const userData = await AuthService.getUserData();
        if (userData) {
            const response = await API.put(`/stockproduct/${productId}`, editedData);
            return response.data;
        }
        } catch (error) {
        console.error("Error updating product:", error);
        throw error;
        }
    },

    async DeleteProductStock(productId) {
        try {
        const userData = await AuthService.getUserData();
        if (userData) {
            await API.delete(`/product/stock/${productId}`);
        }
        } catch (error) {
        console.error("Error deleting product:", error);
        throw error;
        }
    },


    };

    export default ProductService;
