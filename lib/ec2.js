const AWS = require("aws-sdk");
const util = require("util");

const POLLING_RATE = 10000;

class EC2Client {
  constructor(instanceId, startupDelay) {
    this.ec2 = new AWS.EC2();
    this.startupDelay = startupDelay;
    this.instanceId = instanceId;
  }

  async start() {
    console.log(`Starting instance ${this.instanceId}`);
    return new Promise((resolve, reject) => {
      this.ec2.startInstances({InstanceIds: [this.instanceId]}, async (err, data) => {
        if (err) {
          return reject(err);
        }

        try {
          await this._waitForRunningState();
        } catch (err) {
          return reject(err);
        }

        console.log(`Started instance ${this.instanceId}`);
        resolve();
      });
    });
  }

  async stop() {
    console.log(`Stopping instance ${this.instanceId}`);
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
    console.log(`Waiting for instance ${this.instanceId} to be in running state`);
    return new Promise((resolve, reject) => {
      const check = () => {
        console.log(`Requesting instance status`);
        const opts = {IncludeAllInstances: true, InstanceIds: [this.instanceId]};
        this.ec2.describeInstanceStatus(opts, (err, data) => {
          if (err) {
            clearInterval(handle);
            reject(err);
          } else {
            // console.log(util.inspect(data, {depth: 5, color: true}));
            const instanceState = data.InstanceStatuses[0].InstanceState.Name;
            console.log(`Instance state: ${instanceState}`);
            if (instanceState == "running") {
              //after instance running, wait for minecraft server to start
              clearInterval(handle);
              setTimeout(() => {resolve()}, this.startupDelay);
            }
          }
        });
      };

      const handle = setInterval(check, POLLING_RATE);
      check();
    });
  }
}

module.exports = EC2Client;
