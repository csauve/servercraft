const EC2Client = require("./lib/ec2");
const BlockingProxy = require("./lib/blockingProxy");

const config = {
  proxyPort: process.env.PROXY_PORT ?
    parseInt(process.env.PROXY_PORT) : 25565,
  clientTimeout: process.env.CLIENT_TIMEOUT ?
    parseInt(process.env.CLIENT_TIMEOUT) : 10000,
  forwardServer: {
    port: process.env.FORWARD_PORT ?
      parseInt(process.env.FORWARD_PORT) : 25565,
    host: process.env.FORWARD_HOST
  },
  instanceId: process.env.INSTANCE_ID,
  inactiveShutdownMins: process.env.INACTIVE_SHUTDOWN_MINS ?
    parseInt(process.env.INACTIVE_SHUTDOWN_MINS) : 10
};

let inactivityTimeout = null;
let instanceAvailable = false;

const instance = new EC2Client(config.instanceId);
const proxy = new BlockingProxy(config.forwardServer, config.clientTimeout, async () => {
  if (!instanceAvailable) {
    await instance.start();
    instanceAvailable = true;
  }
});

proxy.on("connections", (count) => {
  if (count == 0 && inactivityTimeout == null) {
    console.log(`Instance will be shut down in ${config.inactiveShutdownMins} minutes`);
    inactivityTimeout = setTimeout(async () => {
      inactivityTimeout = null;
      instanceAvailable = false;
      await instance.stop();
    }, config.inactiveShutdownMins * 60 * 1000);
  } else if (count > 0 && inactivityTimeout != null) {
    console.log(`Proxy connection count is ${count}. Cancelling instance shutdown`);
    clearTimeout(inactivityTimeout);
    inactivityTimeout = null;
  }
});

proxy.listen(config.proxyPort);
