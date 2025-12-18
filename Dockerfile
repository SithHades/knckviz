# --- Stage 1: Build Stage ---
FROM node:lts-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
# Doing this before copying the rest of the code leverages Docker caching
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Build the Astro project (outputs to the /dist folder by default)
RUN npm run build

# --- Stage 2: Runtime Stage ---
FROM nginx:stable-alpine AS runtime

# Copy the static build from the first stage to Nginx's serving directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 to the outside world
EXPOSE 80

# Nginx starts automatically by default in the official image
