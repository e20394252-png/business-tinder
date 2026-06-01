FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
