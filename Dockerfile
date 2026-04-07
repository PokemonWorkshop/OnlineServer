FROM node:lts-alpine3.21

WORKDIR /usr/src/app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .

# Logs directory (mounted as volume in compose)
RUN mkdir -p logs

CMD ["npm", "run", "dev"]
