FROM node:18-bullseye-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY --chown=node:node package*.json ./
RUN npm install

# Bundle app source
COPY --chown=node:node . .

# Run as default root to ensure Railway Volumes allow SQLite R/W access

# Expose port to outside world
EXPOSE 3001

# Start command
CMD [ "npm", "start" ]
