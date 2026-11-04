# 셀프호스팅 이미지. fi-workers 플랫폼(infra/platform)에서 박스가 직접 빌드한다.
FROM node:24.22.1-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN yarn install --immutable
ENV NEXT_TELEMETRY_DISABLED=1
ENV ENVIRONMENT=production
RUN yarn workspace @w0nder/w0nder-land build

FROM node:24.22.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ENV ENVIRONMENT=production
COPY --from=build --chown=node:node /app/src/w0nder-land/.next/standalone ./
COPY --from=build --chown=node:node /app/src/w0nder-land/.next/static ./src/w0nder-land/.next/static
COPY --from=build --chown=node:node /app/src/w0nder-land/public ./src/w0nder-land/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/w0nder-land/server.js"]
