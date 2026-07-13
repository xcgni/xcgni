# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npx svelte-kit sync && npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/challenge-bank ./challenge-bank
COPY --from=build /app/CHANGELOG.md ./CHANGELOG.md
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
# Run as the unprivileged user the node image ships with (security audit: container
# must not run as root). The app only reads bundled files and talks to Postgres -
# no disk writes, no privileged ports - so non-root costs nothing.
USER node
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
