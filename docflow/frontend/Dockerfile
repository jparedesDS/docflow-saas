# Build stage
FROM node:18-alpine AS build

WORKDIR /app

COPY docflow/frontend/package.json docflow/frontend/package-lock.json* ./
RUN npm ci --silent

COPY docflow/frontend/ .

ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY docflow/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
