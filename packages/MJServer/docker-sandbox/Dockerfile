# Simplified Docker Sandbox for Web Chat Gateway
FROM node:22-alpine

# Install essential development tools
RUN apk --no-cache add \
    git bash python3 py3-pip curl \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont

# Install Playwright globally
RUN npm install -g playwright-core

# Create non-root user
RUN adduser -u 10001 -D -s /bin/bash sandboxuser

# Setup workspace
WORKDIR /app
RUN mkdir -p /output && chown sandboxuser:sandboxuser /output

# Copy files
COPY package.json package-lock.json* /app/
RUN npm install --production || npm install

COPY . /app/
RUN chown -R sandboxuser:sandboxuser /app

USER sandboxuser
ENV HOME=/home/sandboxuser
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 3000
CMD ["node", "src/index.js"]
