const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      pathRewrite: (path) => '/api' + path,
      onError: (err, req, res) => {
        console.error('[Proxy]', err.message);
        res.status(500).json({ error: 'Could not connect to backend on port 5000' });
      }
    })
  );

  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      ws: true
    })
  );
};
