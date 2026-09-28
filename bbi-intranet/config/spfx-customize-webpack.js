/** Keep browser URLs on localhost, but listen outside the Docker loopback interface. */
module.exports = function (config) {
  if (config.devServer) {
    config.devServer.host = '0.0.0.0';
    config.devServer.open = false;
  }
};
