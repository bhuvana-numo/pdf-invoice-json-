# Start from Node.js base image
FROM node:18

# Set working directory inside the container
WORKDIR /app

# Copy all files into the container
COPY . .

# Install dependencies
RUN npm install

# Expose port if your app runs a web server (like Express)
EXPOSE 3000

# Command to start the app
CMD ["node", "server.js"]
