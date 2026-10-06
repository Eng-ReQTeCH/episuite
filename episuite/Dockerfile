FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json server.mjs caldav.mjs ./
RUN npm ci --omit=dev
COPY public ./public
ENV HOST=0.0.0.0 PORT=3210
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 3210
CMD ["node", "server.mjs"]
