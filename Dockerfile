ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine
WORKDIR /usr/src/app
COPY ./dist .
RUN npm ci
EXPOSE 3000
CMD ["node", "index.js", "3000"]
