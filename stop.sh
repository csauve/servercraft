#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

docker stop servercraft
docker rm servercraft --force
docker rmi servercraft_image --force

echo "Proxy worker has been terminated and flushed from Docker. Run ./build.sh to rebuild"