const net = require("net");
const EventEmitter = require("events");

class PausingProxy extends EventEmitter {
  constructor(serverConfig, clientTimeout) {
    super();
    this.paused = true;
    this.serverConfig = serverConfig;
    this.clientTimeout = clientTimeout;
    this.proxy = net.createServer(this._handleClientConnection.bind(this));
  }

  _emitConnections() {
    this.proxy.getConnections((err, count) => {
      if (err) throw err;
      this.emit("connections", count);
    });
  }

  pause() {
    console.log("Pausing proxy");
    this.paused = true;
    this.emit("paused");
  }

  resume() {
    console.log("Resuming proxy");
    this.paused = false;
    this.emit("resumed");
  }

  async _resumedPromise() {
    return new Promise((resolve) => {
      if (!this.paused) {
        resolve();
        return;
      }
      this.once("resumed", () => {
        resolve();
      });
    });
  }

  async _handleClientConnection(clientSocket) {
    console.log(`New proxy client at ${clientSocket.remoteAddress}`);
    clientSocket.setTimeout(this.clientTimeout);
    this._emitConnections();

    try {
      await this._resumedPromise();

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
    this._emitConnections();
  }
}

module.exports = PausingProxy;
