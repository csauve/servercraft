# env setup
FROM openjdk:8u151-jre-alpine3.7
RUN apk add --no-cache curl gettext

# paths
ENV \
  SRC_HOME="/server" \
  DATA_HOME="/data"

#setup minecraft server
WORKDIR $SRC_HOME
COPY \
  download-server.sh \
  server.properties.template \
  run.sh \
  ./
RUN ["sh", "download-server.sh", "1.12.2"]
# jvm startup optimization
RUN ["java", "-Xshare:dump"]

# defaults for configurable server properties
ENV \
  MOTD="\u00A76welcome\!" \
  RCON_PASSWORD="changeme" \
  GAMEMODE=0 \
  DIFFICULTY=2 \
  PVP=false \
  MAX_PLAYERS=20

EXPOSE 25564 25575
ENTRYPOINT ["/bin/sh"]
CMD ["run.sh"]
