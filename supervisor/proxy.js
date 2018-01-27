const net = require("net");
const {Rcon} = require("rcon-client");
const AWS = require("aws-sdk");

const config = {
  proxyPort: 25565,
  healthCheckIntervalSecs: 10,
  emptyShutdownMins: 1,
  servicePollingRateMs: 1000,
  server: {
    ecsService: process.env.ECS_SERVICE || "servercraft-server",
    ecsCluster: process.env.ECS_CLUSTER || "default",
    host: process.env.SERVER_HOST || "localhost",
    port: process.env.SERVER_PORT || 25564,
    rconPort: process.env.RCON_PORT || 25575,
    rconPassword: process.env.RCON_PASSWORD
  }
};

const serverState = {
  available: false,
  emptySince: null
};

const ecs = new AWS.ECS();

const setDesiredCount = async function(count) {
  console.log(`Setting desired count of ${config.server.ecsService} to ${count}`);
  const serviceOpts = {
    desiredCount: count,
    service: config.server.ecsService,
    cluster: config.server.ecsCluster
  };
  return new Promise((resolve, reject) => {
    ecs.updateService(serviceOpts, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

const waitForServiceCount = async function(count) {
  console.log(`Waiting for ${config.server.ecsService} count to be ${count}`);
  return new Promise((resolve, reject) => {
    const handle = setInterval(() => {
      const serviceOpts = {
        services: [config.server.ecsService],
        cluster: config.server.ecsCluster,
      };
      ecs.describeServices(serviceOpts, (err, data) => {
        if (err) {
          clearInterval(handle);
          reject(err);
        } else {
          const currCount = data.services[0].runningCount;
          if (currCount == count) {
            clearInterval(handle);
            resolve(count);
          }
        }
      });
    }, config.servicePollingRateMs)
  })
};

//maybe be called multiple times -- must be idempotent
const stopServer = async function() {
  await setDesiredCount(0);
  await waitForServiceCount(0);
  serverState.available = false;
  serverState.emptySince = null;
};

//maybe be called multiple times -- must be idempotent
const startServer = async function() {
  await setDesiredCount(1);
  await waitForServiceCount(1);
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
