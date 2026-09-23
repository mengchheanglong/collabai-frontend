FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY src ./src
COPY public ./public
ARG API_BASE_URL=https://api.example.com/api/v1
RUN sed -i "s#http://localhost:4000/api/v1#${API_BASE_URL}#; s/production: false/production: true/" src/environments/environment.ts && pnpm build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/collabai-frontend/browser /usr/share/nginx/html
EXPOSE 80
