FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app

#RUN apt-get update && apt-get install -y --no-install-recommends \
#    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

RUN npm install --omit=dev
RUN npx playwright install --with-deps firefox

#RUN npm ci --omit=dev
#RUN npx playwright install firefox

RUN npm cache clean --force

ENV DISPLAY=:99
ENV NODE_ENV=production

EXPOSE 9066

CMD ["sh", "-c", "rm -f /tmp/.X99-lock && Xvfb :99 -screen 0 1280x720x24 & npm start"]
