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

# Build-time environment variables for Safe on DOS
# These MUST be set at build time (NEXT_PUBLIC_* bake into JS bundles)
ENV NEXT_PUBLIC_WC_PROJECT_ID=4b6b77d337588564379b0ef8f3a5c479
ENV NEXT_PUBLIC_GATEWAY_URL_PRODUCTION=https://safe.doschain.com/cgw
ENV NEXT_PUBLIC_DEFAULT_MAINNET_CHAIN_ID=7979
ENV NEXT_PUBLIC_IS_OFFICIAL_HOST=false
ENV NEXT_PUBLIC_IS_PRODUCTION=true
ENV NEXT_PUBLIC_SAFE_VERSION=1.4.1
ENV NEXT_PUBLIC_BRAND_NAME="Safe on DOS"
ENV NEXT_PUBLIC_BRAND_LOGO=/images/dos-logo.svg
ENV NEXT_PUBLIC_APP_HOMEPAGE=https://safe.doschain.com

# Build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

# Runtime
ENV PORT=8080
EXPOSE 8080

RUN npx -y serve --version
CMD ["npx", "serve", "out", "-l", "8080"]
