FROM node:16-alpine3.11

WORKDIR /usr/app

ADD dist/. ./dist
COPY package.json ./
RUN npm install 

CMD ["node", "dist/index.js"]
