FROM node:21.7.2-alpine3.19

WORKDIR /app/
COPY package*.json .
COPY tsconfig*.json .
COPY vitest.config.ts .
COPY .env .
RUN npm install
