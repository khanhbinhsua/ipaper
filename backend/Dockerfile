# ===== Build stage =====
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ===== Production stage =====
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=UTC
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/assets ./assets
EXPOSE 3000
CMD ["node", "dist/main.js"]
