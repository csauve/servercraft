# servercraft
Want to run your Minecraft server in AWS? Use _servercraft_ to keep your costs down (~$4/month). A lightweight supervisor runs in front of the minecraft server, starting the instance on an initial connection attempt, reverse-proxying TCP connections to the server, and shutting it down after a period of emptiness.

Aside from a minor delay when the first player joins, players are none-the-wiser of this orchestration. The supervisor can be run 24/7 on cheap instances for the appearance of high availability, with the minecraft server itself running on more powerful instances only when needed.

This assumes working knowledge with AWS. The recommended setup is as follows:

## Server instance setup
Provision an EC2 instance of the desired type. Some things to consider:

* Use a lightweight AMI like `Alpine-3.7-r2-Hardened-EC2` for a quick boot
* Keep the minecraft server & world on the root EBS volume
* Provision as much space as you need/want to pay for
* Consider typical player counts when choosing the instance type. It can always be changed later
* Make sure the instance's security group is open to the Minecraft server port
* I suggest assigning an elastic IP to it's ENI for troubleshooting purposes

To speed things up, here's a server start script:

```sh
#!/bin/sh
set -e

SERVER_HOME="/home/alpine"
HEAP_SIZE="2048M"

cd $SERVER_HOME

case "$1" in
"stop")
  screen -X -S minecraft quit
  ;;
"start")
  screen -S minecraft -d -m java -server -Xmx${HEAP_SIZE} -Xms${HEAP_SIZE} -jar minecraft_server.jar nogui
  ;;
esac
```

OpenRC service:

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
