FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Run Vite in host mode so it is accessible from the Docker container port mappings
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
