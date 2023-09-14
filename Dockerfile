# Use the official Node.js v18 image as the base
FROM node:18

# Install git, which is required to clone the repository
RUN apt-get update && apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/* 

# Clone the GitHub repository
RUN git clone https://github.com/joeaa17/rapid.git /rapid

# Set the working directory
WORKDIR /rapid

# Install Node.js dependencies for the project
RUN npm install

# Command to run when the container starts
CMD ["npm", "start"]
