FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ── Build stage ───────────────────────────────────────────────────────────────
FROM base AS build
COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# ── Production runner stage ───────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 flint
USER flint

COPY --from=build --chown=flint:nodejs /app/dist ./dist
COPY --from=build --chown=flint:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=flint:nodejs /app/prisma ./prisma
COPY --from=build --chown=flint:nodejs /app/package.json ./

EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/server.js"]
