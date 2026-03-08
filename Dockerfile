FROM node:lts-alpine3.21

WORKDIR /usr/src/app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY . .
RUN npm run build

# Logs directory (mounted as volume in compose)
RUN mkdir -p logs

CMD ["node", "dist/index.js"]
