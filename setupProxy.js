const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api', // Change this to match your API endpoint
    createProxyMiddleware({
      target: 'https://th-calendar-api.herokuapp.com', // Target API
      changeOrigin: true,
      pathRewrite: {
        '^/api': '', // Remove '/api' from the request path
      },
    })
  );
};
