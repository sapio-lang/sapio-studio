const {createProxyMiddleware} = require('http-proxy-middleware');
module.exports = function(app){
    app.use(createProxyMiddleware('/backend', {target: 'http://localhost:5000', changeOrigin: true,
        pathRewrite:{'^/backend': "/"}}));
    app.use(createProxyMiddleware('/socket', {target: 'http://localhost:8888', ws: true, changeOrigin: true,
        pathRewrite:{'^/socket': "/"}}));
}
