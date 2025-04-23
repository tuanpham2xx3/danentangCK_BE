# Base image
FROM node:18-alpine

# Tạo thư mục làm việc trong container
WORKDIR /app

# Copy package.json và package-lock.json
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ mã nguồn
COPY . .

# Expose cổng app đang chạy (nếu dùng PORT=3000)
EXPOSE 3000

# Khởi chạy ứng dụng
CMD ["node", "server.js"]

# Copy service account file
COPY firebase-service-account.json ./firebase-service-account.json
