FROM node:8.12-jessie

ENV NODE_ENV=production

WORKDIR /src
ADD package-lock.json package.json ./
RUN npm install

ADD . /src

CMD ["/usr/local/bin/node", "/src/app.js"]
