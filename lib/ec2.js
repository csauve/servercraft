const AWS = require("aws-sdk");
const util = require("util");

const POLLING_RATE = 5000;

const delay = async function(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, timeout);
  });
};

class EC2Client {
  constructor(instanceId, startupDelay) {
    this.ec2 = new AWS.EC2();
    this.instanceId = instanceId;
    this.startupDelay = startupDelay;
    console.log(`Instance ${this.instanceId} is target of EC2 client`);
  }

  async start() {
    return new Promise((resolve, reject) => {
      this._checkIsRunning((err, running) => {
        if (err) return reject(err);
        if (running) {
          console.log(`Instance is already running`);
          resolve();
        } else {
          console.log("Starting instance");
          const start = new Date().getTime();
          this.ec2.startInstances({InstanceIds: [this.instanceId]}, async (err, data) => {
            if (err) return reject(err);

            try {
              await this._waitForRunningState();

              const elapsedSec = (new Date().getTime() - start) / 1000;
              console.log(`Instance running after ${elapsedSec}s`);

              //after instance running, wait for minecraft server to start
              console.log(`Waiting ${this.startupDelay / 1000}s for minecraft`);
              await delay(this.startupDelay);
            } catch (err) {
              return reject(err);
            }

            resolve();
          });
        }
      });
    });
  }

  async stop() {
    console.log("Requesting stop of instance");
    return new Promise((resolve, reject) => {
      this.ec2.stopInstances({InstanceIds: [this.instanceId]}, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  async _waitForRunningState() {
    console.log("Waiting for instance to be in running state");
    return new Promise((resolve, reject) => {
      const check = () => {
        this._checkIsRunning((err, running) => {
          if (err) {
            clearInterval(handle);
            reject(err);
          } else if (running) {
            clearInterval(handle);
            resolve();
          }
        });
      };

      const handle = setInterval(check, POLLING_RATE);
      check();
    });
  }

  _checkIsRunning(cb) {
    const opts = {IncludeAllInstances: true, InstanceIds: [this.instanceId]};
    this.ec2.describeInstanceStatus(opts, (err, data) => {
      if (err) return cb(err);
      // console.log(util.inspect(data, {depth: 5, color: true}));
      cb(null, data.InstanceStatuses[0].InstanceState.Name == "running");
    });
  }
}

module.exports = EC2Client;
