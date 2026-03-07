# =============================================
# Stage 1: Builder
# =============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps and build
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# =============================================
# Stage 2: Production
# =============================================
FROM node:20-alpine AS production

WORKDIR /app

# Copy only production artifacts
COPY package*.json ./
RUN npm install --omit=dev

# Install Playwright firefox browser
RUN npx playwright install firefox

COPY --from=builder /app/dist ./dist

# =========================
# Expose port
# =========================
EXPOSE 8080

# =========================
# Environment
# =========================
ENV DISPLAY=:99
ENV NODE_ENV=production

# =========================
# Start app
# =========================
CMD ["sh", "-c", "rm -f /tmp/.X99-lock && Xvfb :99 -screen 0 1280x720x24 & npm start"]

