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
      

    async DeleteProductStock(id) {
        try {
        const userData = await AuthService.getUserData();
        if (userData) {
            await API.delete(`/stockproduct/${id}`);
        }
        } catch (error) {
        console.error("Error deleting stock product:", error);
        throw error;
        }
    },


    };

    export default ProductService;
