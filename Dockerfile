FROM node:24-bookworm-slim
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --omit=dev
COPY backend ./backend
COPY frontend ./frontend
ENV NODE_ENV=production
WORKDIR /app/backend
CMD ["node", "src/server.js"]
