# env setup
FROM openjdk:8u151-jre-alpine3.7
RUN apk add --no-cache curl

#setup minecraft server
COPY \
  download-server.sh \
  eula.txt \
  server.properties \
  /
RUN ["sh", "download-server.sh", "1.12.2"]
VOLUME ["/world"]

# jvm startup optimization
RUN ["java", "-Xshare:dump"]

EXPOSE 25565 25575
CMD ["java", "-Xshare:on", "-Xmx1024M", "-Xms1024M", "-jar", "minecraft_server.jar", "nogui"]
