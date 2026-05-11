FROM node:24-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm install

COPY . .

RUN npm run prisma:generate
RUN npm run build

FROM node:24-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV TZ=America/Fortaleza
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm install --production
RUN npm run prisma:generate

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads

EXPOSE 6000

CMD ["sh", "-c", "node dist/main.js"]
