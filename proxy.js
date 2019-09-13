const EC2Client = require("./lib/ec2");
const PausingProxy = require("./lib/pausingProxy");

const config = {
  proxyPort: process.env.LISTEN_PORT ?
    parseInt(process.env.LISTEN_PORT) : 25565,
  clientTimeout: process.env.CLIENT_TIMEOUT ?
    parseInt(process.env.CLIENT_TIMEOUT) : 120000,
  forwardServer: {
    port: process.env.FORWARD_PORT ?
      parseInt(process.env.FORWARD_PORT) : 25565,
    host: process.env.FORWARD_HOST
  },
  instanceId: process.env.INSTANCE_ID,
  startupDelay: process.env.STARTUP_DELAY ?
    parseInt(process.env.STARTUP_DELAY) : 16000,
  inactiveShutdownSecs: process.env.INACTIVE_TIMEOUT ?
    parseInt(process.env.INACTIVE_TIMEOUT) : 900000
};

let inactivityTimeout = null;

//proxy begins in paused state
const proxy = new PausingProxy(config.forwardServer, config.clientTimeout);
const instance = new EC2Client(config.instanceId, config.startupDelay);

const scheduleShutdown = async function() {
  try {
    if (inactivityTimeout == null) {
      console.log(`Instance will be shut down in ${config.inactiveShutdownSecs/1000}s if no connection activity`);
      inactivityTimeout = setTimeout(async () => {
        inactivityTimeout = null;
        proxy.pause();
        await instance.stop();
      }, config.inactiveShutdownSecs);
    }
  } catch (err) {
    console.error("Failed to perform scheduled shutdown", err);
  }
};

const ensureAvailable = async function() {
  try {
    if (inactivityTimeout != null) {
      console.log("Cancelling instance shutdown");
      clearTimeout(inactivityTimeout);
      inactivityTimeout = null;
    }
    await instance.start();
    proxy.resume();
  } catch (err) {
    console.error("Failed to ensure server availability", err);
  }
};

//emitted at startup with 0 connections
proxy.on("connections", (count) => {
  console.log(`Client connection count is ${count}`);
  if (count > 0) {
    ensureAvailable();
  } else {
    scheduleShutdown();
  }
});

proxy.listen(config.proxyPort);

process.on('SIGINT', function() {
  console.log( "\nGracefully exiting from SIGINT (Ctrl-C)" );
  process.exit(1);
});
