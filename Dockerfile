FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Ensure standard permissions
USER node

# Expose port to outside world
EXPOSE 3001

# Start command
CMD [ "npm", "start" ]
