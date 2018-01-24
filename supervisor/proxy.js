const net = require("net");
const {Rcon} = require("rcon-client");

const config = {
  proxyPort: 8080,
  healthCheckIntervalSecs: 10,
  emptyShutdownMins: 1,
  server: {
    host: "localhost",
    port: 25565,
    rconPort: 25575,
    rconPassword: "test"
  }
};

const serverState = {
  available: false,
  emptySince: null
};

const stopServer = async function() {
  console.log("Stopping the server");
  //todo
  await new Promise(resolve => setTimeout(resolve, 10000));
  serverState.available = false;
  serverState.emptySince = null;
};

const startServer = async function() {
  console.log("Starting the server");
  //todo
  await new Promise(resolve => setTimeout(resolve, 10000));
  serverState.available = true;
  serverState.emptySince = null;
};

const getServerStats = async function() {
  const rcon = new Rcon();
  try {
    await rcon.connect({
      host: config.server.host,
      port: config.server.rconPort,
      password: config.server.rconPassword
    });
  } catch (err) {
    return null;
  }

  const response = await rcon.send("list");
  const match = response.match(/There are (\d+)\/(\d+) players online:.*/);
  if (!match) throw new Error(`Failed to parse player count from response: ${response}`);
  const playerCount = parseInt(match[1]);
  rcon.disconnect();
  return {playerCount};
};

const healthCheck = async function() {
  const stats = await getServerStats();
  const newAvailability = stats != null;
  if (newAvailability != serverState.available) {
    console.log(`Server availability became ${newAvailability}`)
    serverState.available = newAvailability;
  }

  if (serverState.available) {
    serverState.emptySince = stats.playerCount == 0 ?
      serverState.emptySince || new Date() :
      null;

    if (serverState.emptySince) {
      const differenceMs = new Date().getTime() - serverState.emptySince.getTime();
      const remainingMs = config.emptyShutdownMins * 60000 - differenceMs;
      console.log(`Empty server will be shut down in ${(remainingMs / 60000).toFixed(2)} minutes`);
      if (remainingMs <= 0) {
        stopServer();
      }
    }
  }
};

const setupPipe = function(serverSocket, clientSocket) {
  clientSocket.pipe(serverSocket);
  serverSocket.pipe(clientSocket);
  console.log("Proxy established for client");
};

const handleClientConnection = async function(clientSocket) {
  try {
    if (!serverState.available) await startServer();
    const serverSocket = net.connect(config.server);
    serverSocket.once("connect", () => setupPipe(serverSocket, clientSocket));

    const destroySockets = () => {
      serverSocket.destroy();
      clientSocket.destroy();
    };

    serverSocket.once("timeout", destroySockets);
    serverSocket.once("close", destroySockets);
    serverSocket.once("error", destroySockets);

    clientSocket.once("close", destroySockets);
    clientSocket.once("error", destroySockets);
  } catch (err) {
    console.error("Error setting up pipe to server", err);
    clientSocket.destroy();
  }
};

console.log(`Proxying ${config.server.host}:${config.server.port} on ${config.proxyPort}`);
const proxy = net.createServer(handleClientConnection);
proxy.listen(config.proxyPort);

console.log(`Beginning health checks on rcon port ${config.server.rconPort}`);
healthCheck();
setInterval(healthCheck, config.healthCheckIntervalSecs * 1000);
