#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

if [ ! -f "config.txt" ]; then
    echo "Config file does not exist!!"
    exit 1
fi

cr=`echo $'\n.'`
cr=${cr%.}

read -s -p "RCON Password: $cr" RCON_PASSWORD
read -s -p "AWS Access ID: $cr" AWS_ACCESS_ID
read -s -p "AWS Access Key: $cr" AWS_ACCESS_KEY

./stop.sh

docker build -t servercraft_image .
docker run -e RCON_PASSWORD -e AWS_ACCESS_ID -e AWS_ACCESS_KEY --env-file config.txt -p 25565:25565 --name servercraft -dit --restart always servercraft_image

sleep 1
bash logs.sh

exit 0