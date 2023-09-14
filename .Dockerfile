# Use a recent version of Ubuntu as the base image
FROM ubuntu:20.04

# Avoid prompts with apt
ENV DEBIAN_FRONTEND=noninteractive

# Install necessary dependencies (you may need to adjust these based on the project requirements)
RUN apt-get update && \
    apt-get install -y git nodejs npm && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* 

# Clone the GitHub repository
RUN git clone https://github.com/joeaa17/rapid.git /rapid

# Set the working directory
WORKDIR /rapid

# Install Node.js dependencies for the project
RUN npm install

# Command to run when the container starts
CMD ["npm", "start"]
