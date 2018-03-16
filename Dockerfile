FROM node:9.4.0-alpine

COPY package-lock.json package.json /
RUN ["npm", "install"]

COPY proxy.js /
COPY lib /lib

EXPOSE 25565
CMD ["node", "proxy.js"]
