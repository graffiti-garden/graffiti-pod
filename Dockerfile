FROM node:21.7.2-alpine3.19

WORKDIR /app/
COPY package*.json .
RUN npm install

COPY . .

CMD npm run test:watch stream.gateway
# CMD npm run start
# CMD npm run test
