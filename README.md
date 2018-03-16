# servercraft
Want to run your Minecraft server in AWS? Use _servercraft_ to keep your costs down. A lightweight supervisor proxy runs in front of the minecraft server, parking initial TCP connections until the instance is ready, and shutting it down after a period of inactivity.

The supervisor can be run 24/7 on cheaper instances for the appearance of high availability, with the minecraft server itself running on a more powerful instance only when needed.

The first player to join will experience a delay, and possibly a timeout. Minecraft has a client-side timeout of **30s**, while it takes **~12s** for an EC2 instance and **~16s** for a Minecraft server to start. This doesn't leave a lot of room to spare!

## Minecraft server instance setup
This assumes working knowledge with AWS. First, provision an EC2 instance to host the Minecraft server. Some things to consider:

* Use a lightweight AMI like `Alpine-3.7-r2-Hardened-EC2` for a quicker boot
* Keep the minecraft server & world on the root EBS volume
* Use a GP2 root volume and a t2.medium for the server to start quick enough to avoid client timeouts when joining.
* Provision as much space as you need/want to pay for
* Consider typical player counts when choosing the instance type. It can always be changed later
* Make sure the instance's security group is open to the Minecraft server port
* I suggest assigning an elastic IP to it's ENI for troubleshooting purposes

Assuming the AMI above, first install some packages:

```sh
sudo apk add wget vim screen openjdk8
```

Next, download the [latest minecraft server JAR](https://minecraft.net/en-us/download/server) and create `~/run.sh` with execute permissions:

```sh
#!/bin/sh
set -e

SERVER_HOME="/home/alpine"
HEAP_SIZE="2048M"

cd $SERVER_HOME
echo eula=true > eula.txt

case "$1" in
"stop")
  screen -X -S minecraft quit
  ;;
"start")
  screen -S minecraft -d -m java -server -Xmx${HEAP_SIZE} -Xms${HEAP_SIZE} -jar server.jar nogui
  ;;
esac
```

The minecraft server needs to start automatically when the instance does. To create an OpenRC service, become root and run: `rc-update add minecraft default` and add the following to `/etc/init.d/minecraft` with execute permissions:

```sh
#!/sbin/openrc-run

start() {
  su - alpine -c "/home/alpine/run.sh start"
}

stop() {
  su - alpine -c "/home/alpine/run.sh stop"
}

depend() {
  need net localmount
  after bootmisc
  after firewall
}
```

Give it a test run, and configure `ops.json` and `server.properties` to your liking.

## Proxy setup
With the server instance set up, we now need this proxy running in front of it. This app is Dockerized so it can be run in ECS. Avoid Fargate because of the higher costs to run a service 24/7. If possible, run this proxy on a reserved instance.

Ensure that the proxy instance or task has an IAM policy to start and stop your EC2 instance:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "ec2:DescribeInstanceStatus",
                "ec2:StartInstances",
                "ec2:StopInstances"
            ],
            "Effect": "Allow",
            "Resource": "<instance ARN here or *>"
        }
    ]
}
```
