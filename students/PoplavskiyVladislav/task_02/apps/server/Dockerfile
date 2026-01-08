FROM node:22-bookworm-slim AS deps

WORKDIR /app

# Prisma generate needs OpenSSL present to pick the correct engine.
# hadolint ignore=DL3008
RUN apt-get update -y \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY prisma ./prisma

RUN npm install --no-audit --no-fund


FROM deps AS build

COPY tsconfig.json ./
COPY src ./src

RUN npm run db:generate && npm run build


FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Prisma engines require OpenSSL to be available in the runtime image.
# hadolint ignore=DL3008
RUN apt-get update -y \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 3001

CMD ["sh", "-c", "npm run db:deploy && node dist/index.js"]
