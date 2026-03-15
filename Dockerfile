FROM node:18-alpine
RUN apk add --no-cache libc6-compat git python3 py3-pip make g++ libusb-dev eudev-dev linux-headers

# Set working directory
WORKDIR /app

# Copy root
COPY . .

# Set working directory to the web app
WORKDIR /app/apps/web

# Enable corepack and configure yarn
RUN corepack enable
RUN yarn config set httpTimeout 300000

# Install dependencies
RUN yarn install --immutable
RUN yarn after-install

# Apply safe-deployments patch (add DOS Chain 7979)
RUN node ../../scripts/patch-safe-deployments.mjs || true

# Build-time environment variables (override via --build-arg)
ARG NEXT_PUBLIC_WC_PROJECT_ID
ARG NEXT_PUBLIC_IS_OFFICIAL_HOST=false

ENV NEXT_PUBLIC_WC_PROJECT_ID=${NEXT_PUBLIC_WC_PROJECT_ID}
ENV NEXT_PUBLIC_IS_OFFICIAL_HOST=${NEXT_PUBLIC_IS_OFFICIAL_HOST}

# Build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

# Runtime
ENV PORT=8080
EXPOSE 8080

CMD ["yarn", "start", "-p", "8080"]
