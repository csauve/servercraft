const net = require("net");
const EventEmitter = require("events");

class BlockingProxy extends EventEmitter {
  constructor(serverConfig, clientTimeout, connectionHook) {
    super();
    this.serverConfig = serverConfig;
    this.connectionHook = connectionHook;
    this.clientTimeout = clientTimeout;

    this.proxy = net.createServer(this._handleClientConnection.bind(this));
  }

  _emitConnections() {
    this.proxy.getConnections((err, count) => {
      if (err) throw err;
      console.log(`Emitting connection count ${count}`);
      this.emit("connections", count);
    });
  }

  async _handleClientConnection(clientSocket) {
    console.log(`New proxy client at ${clientSocket.remoteAddress}`);
    clientSocket.setTimeout(this.clientTimeout);
    this._emitConnections();

    try {
      //wait for server available
      await this.connectionHook();

      const serverSocket = net.connect(this.serverConfig);

      serverSocket.once("connect", () => {
        clientSocket.pipe(serverSocket);
        serverSocket.pipe(clientSocket);
        console.log(`Pipe established for client at ${clientSocket.remoteAddress}`);
      });

      const destroySockets = () => {
        serverSocket.destroy();
        clientSocket.destroy();
        this._emitConnections();
      };

      serverSocket.once("timeout", destroySockets);
      serverSocket.once("close", destroySockets);
      serverSocket.once("error", destroySockets);

      clientSocket.once("close", destroySockets);
      clientSocket.once("error", destroySockets);
    } catch (err) {
      console.error("Error setting up pipe to server", err);
      clientSocket.destroy();
      this._emitConnections();
    }
  }

  listen(proxyPort) {
    console.log(`Proxying ${this.serverConfig.host}:${this.serverConfig.port} on ${proxyPort}`);
    this.proxy.listen(proxyPort);
  }
}

module.exports = BlockingProxy;
