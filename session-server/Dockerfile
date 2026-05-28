FROM node:20-alpine

WORKDIR /app

# 先复制 package.json 和 package-lock.json
COPY package*.json ./

# 清理 npm 缓存并安装依赖
RUN npm cache clean --force && npm install

# 复制源代码
COPY server.js ./

EXPOSE 3102

CMD ["node", "server.js"]
