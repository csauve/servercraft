# servercraft
Want to run your Minecraft server in AWS? Use _servercraft_ to keep your costs down. A lightweight supervisor proxy runs in front of the minecraft server, parking initial TCP connections until the instance is ready, and shutting it down after a period of inactivity.

The supervisor can be run 24/7 on cheaper instances for the appearance of high availability, with the minecraft server itself running on a more powerful instance only when needed.

The first player to join will experience a delay, and possibly a timeout. Minecraft has a client-side timeout of **30s**, while it takes **~12s** for an EC2 instance and **~16s** for a Minecraft server to start. This doesn't leave a lot of room to spare!

## Minecraft server instance setup
This assumes working knowledge with AWS. First, provision an EC2 instance to host the Minecraft server. Some things to consider:

* Use a lightweight AMI like `alpine-ami-3.9.4` for a quicker boot
* Keep the minecraft server & world on the root EBS volume
* Use a GP2 root volume and a t2.medium/t3.medium for the server to start quick enough to avoid client timeouts when joining.
* Provision as much space as you need/want to pay for
* Consider typical player counts when choosing the instance type. It can always be changed later
* Make sure the instance's security group is open to the Minecraft server port
* I suggest assigning an elastic IP to it's ENI for troubleshooting purposes

Assuming the AMI above, first install some packages:

```sh
sudo apk add wget vim screen openjdk8
```

Next, download the [latest minecraft server JAR](https://minecraft.net/en-us/download/server) and save it to `/home/alpine/minecraft` and create `~/run.sh` with execute permissions:

```sh
#!/bin/sh
set -e

SERVER_HOME="/home/alpine/minecraft"
HEAP_SIZE="4096M"

cd $SERVER_HOME

command()
{
  screen -S minecraft -p 0 -X stuff "$1^M"
}

stop()
{
  command "stop"
  sleep 4
  screen -X -S minecraft quit
}

start()
{
  if ! screen -list | grep -q "minecraft"; then
    screen -S minecraft -d -m java -server -Xmx${HEAP_SIZE} -Xms${HEAP_SIZE} -jar server.jar nogui   
  fi
}

case "$1" in
"stop")
  stop
  ;;
"start")
  start
  ;;
"restart")
  stop
  start
  ;;
"logs")
  cat logs/latest.log
  ;;
"command")
  command "$2"
esac
exit 0
```

That script acts as a wrapper for the server. You can start, stop, restart and pass a command to the Minecraft console with `./run.sh command <command>`

The minecraft server needs to start automatically when the instance does. To create an OpenRC service, become root and add the following to `/etc/init.d/minecraft` with execute permissions. Run: `rc-update add minecraft default`:

```sh
#!/sbin/openrc-run

start() {
  ebegin "Starting minecraft"
  start-stop-daemon --background --start -u alpine \
  --exec /home/alpine/run.sh  --make-pidfile \
  --pidfile /home/alpine/minecraft.pid -- start
  eend $?
}

stop() {
  ebegin "Stopping minecraft"
  start-stop-daemon --stop --exec /home/alpine/run.sh \
  --pidfile /home/alpine/minecraft.pid -- stop
  eend $?
}

reload() {
  ebegin "Reloading myApp"
  start-stop-daemon --exec /home/alpine/run.sh \
  --pidfile /home/alpine/minecraft.pid -- restart
  eend $?
}

depend() {
  need net localmount
  after bootmisc
  after firewall
}
```

_servercraft_ passes `/stop` over RCON to save your server disk and gracefully shut it down before stopping the instance. This prevents world save errors. In `server.properties` set `enable-rcon` to `true`, `rcon.password` to whatever you like and `rcon.port` to your desired port (default and recommended is 25575).

*Security Note: The RCON password grants full access to run any command on your server as console. Do not store it in plain text or allow it to be exposed.*

Give it a test run, and configure everything else to your liking.

## Proxy setup
With the server instance set up, we now need this proxy running in front of it. This app is Dockerized so it can be run in ECS. Avoid Fargate because of the higher costs to run a service 24/7. If possible, run this proxy on a reserved instance. Additionally, its recommended to run the Minecraft server and proxy instances in the same region to avoid intra region bandwidth fees.

The following guide is for Docker:

Make sure Docker is installed and enabled as a service (eg. `sudo systemctl enable docker`)

`git clone` this repository to the instance and `cd` into it. Make `build.sh`, `stop.sh` and `logs.sh` executable using `chmod`.

Copy `sampleconfig.txt` and rename to `config.txt` (**must do this**) and configure as follows:

- `LISTEN_PORT` what port should the proxy server listening on
- `FORWARD_PORT` what port is the Minecraft server listening on
- `FORWARD_PORT` what is the ipv4 (not hostname) of the Minecraft server. (Recommend using an Elastic ip)
- `CLIENT_TIMEOUT` timeout of the proxy tunnel (ms)
- `INACTIVE_TIMEOUT` when there is no player activity, how long should the server wait before shutting down (ms) eg. 15 minutes = 900000
- `STARTUP_DELAY` how long should the proxy wait for the server to start
- `INSTANCE_ID` your instance's id
- `INSTANCE_REGION` your instance's region eg. us-east-1

Next go into the AWS IAM settings and create a new user. Create a set of access keys under Security credentials and note down the id and key (you'll need them later):

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
            "Resource": "*"
        }
    ]
}
```

*Security Note: This IAM user has full access to start and stop all of your EC2 instances. Do not store the auth key in plain text or anywhere it may be exposed. An attacker can view the auth id and key using `docker inspect` so make sure the server firewall is secure and only accepts ssh access from trusted hosts.*

On the proxy instance run the build script with `./build.sh` and follow the prompts. The RCON password is the one you put in `server.properties`, and the AWS access id and key are from the IAM user you set up in the previous step. These credentials are not included in `config.txt` because an attacker could wreak havoc if they gained access to them.

The proxy will now be running as a Docker container called `servercraft` (image is `servercraft-image`) in the background at all times (if Docker has been enabled as a service). Read the logs with `./logs.sh` and rebuild it if you change any of the config.

If you want to stop the proxy service for server testing, maintanence, or if you just want your server to run 24/7 for a period of time run `./stop.sh`. This will completely remove the proxy worker from your Docker cache so you'll need to `./build` to start again. If you've lost your auth key you'll need to generate another set of security credentials from the IAM dashboard for your user.