FROM node:9.4.0-alpine

COPY \
  package-lock.json \
  package.json \
  proxy.js \
  /
RUN ["npm", "install"]

EXPOSE 8080
CMD ["node", "proxy.js"]