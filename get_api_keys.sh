#!/bin/bash

# 配置
BASE_URL="https://claudexia.com/api/v1"

# 检查参数
if [ $# -lt 2 ]; then
  echo "用法: $0 <email> <password>"
  echo "示例: $0 457683994@qq.com 123456"
  exit 1
fi

EMAIL="$1"
PASSWORD="$2"

# 1. 登录获取 access_token
echo "正在登录 (email: ${EMAIL})..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${EMAIL}\",\"password\": \"${PASSWORD}\"}")

# 检查登录是否成功
CODE=$(echo "$LOGIN_RESPONSE" | jq -r '.code')
if [ "$CODE" != "0" ]; then
  echo "登录失败: $(echo "$LOGIN_RESPONSE" | jq -r '.message')"
  exit 1
fi

# 提取 access_token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.access_token')
echo "登录成功，获取到 access_token"

# 2. 获取 API Keys
echo "正在获取 API Keys..."
KEYS_RESPONSE=$(curl -s -X GET "${BASE_URL}/keys?page=1&page_size=10&sort_by=created_at&sort_order=desc" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")

# 检查获取是否成功
CODE=$(echo "$KEYS_RESPONSE" | jq -r '.code')
if [ "$CODE" != "0" ]; then
  echo "获取 API Keys 失败: $(echo "$KEYS_RESPONSE" | jq -r '.message')"
  exit 1
fi

# 提取所有 key 并输出为字符串数组格式
echo "API Keys:"
echo "$KEYS_RESPONSE" | jq -r '.data.items[].key' | jq -Rs 'split("\n") | map(select(length > 0))'
