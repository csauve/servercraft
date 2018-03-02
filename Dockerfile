FROM node:9.4.0-alpine

COPY \
  package-lock.json \
  package.json \
  proxy.js \
  lib \
  /

RUN ["npm", "install"]

EXPOSE 25565
CMD ["node", "proxy.js"]
