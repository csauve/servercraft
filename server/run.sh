#!/bin/sh
set -e

envsubst < "${SRC_HOME}/server.properties.template" > "${DATA_HOME}/server.properties"
echo "eula=true" > "${DATA_HOME}/eula.txt"

cd "$DATA_HOME"
exec java \
  -server \
  -Xmx1024M \
  -Xms1024M \
  -jar \
  "$SRC_HOME/minecraft_server.jar" \
  nogui
