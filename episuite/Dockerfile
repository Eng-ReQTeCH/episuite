FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
COPY public ./public
ENV HOST=0.0.0.0 PORT=3210
RUN mkdir /app/data /app/backups && chown node:node /app/data /app/backups
USER node
EXPOSE 3210
CMD ["node", "server.mjs"]
