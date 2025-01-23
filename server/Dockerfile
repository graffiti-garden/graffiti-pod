FROM node:23-alpine

WORKDIR /app/
COPY package*.json .
COPY tsconfig*.json .
COPY vitest.config.ts .
COPY .env .
RUN npm install
