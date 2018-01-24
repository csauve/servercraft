# servercraft
Want to run your Minecraft server in AWS? Use _servercraft_ to keep your costs down. A lightweight supervisor runs in front of the minecraft server, starting the server on an initial connection attempt, reverse-proxying TCP connections to the server, and shutting it down after a period of no use.

Aside from a minor delay when the first player joins, players are none-the-wiser of this orchestration. The supervisor can be run 24/7 on cheap instances for the appearance of high availability, with the minecraft server itself running on more powerful instances only when needed.

_This project is still a WIP._

## Todo
* Write CloudFormation templates
* Configuration management
* Implement calls to EC2 container service to start and stop the server.

## Ideas for later
* Scaling up the EC2 instances as more players join. Kick all players when the new server is provisioned and have them rejoin the proxy?
