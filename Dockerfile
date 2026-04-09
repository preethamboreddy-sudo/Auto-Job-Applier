FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY --chown=node:node package*.json ./
RUN npm install

# Bundle app source
COPY --chown=node:node . .

# Ensure standard permissions
USER node

# Expose port to outside world
EXPOSE 3001

# Start command
CMD [ "npm", "start" ]
