FROM node:20-alpine

WORKDIR /workspace

COPY package*.json ./
RUN apk add --no-cache postgresql-client \
  && npm ci

COPY . .

ENV PORT=4173
EXPOSE 4173

CMD ["npm", "run", "studio"]
