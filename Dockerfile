# Dockerfile
FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
# python3/make/g++ needed to compile better-sqlite3 native module on Alpine
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

FROM base AS builder
ENV DATABASE_URL=file:/tmp/build.db
ARG NEXT_PUBLIC_SEERR_URL
ENV NEXT_PUBLIC_SEERR_URL=$NEXT_PUBLIC_SEERR_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server.ts ./server.ts
COPY package*.json ./
COPY .env.example ./

RUN mkdir -p /app/data /app/.next/cache
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app/data /app/.next/cache
USER nextjs

EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/tsx server.ts"]
