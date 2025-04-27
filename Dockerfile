FROM node:23.11.0-alpine

WORKDIR /usr/app

COPY package.json .

RUN npm install --omit=dev
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "index.js"]
