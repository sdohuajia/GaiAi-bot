#!/usr/bin/env bash
set -euo pipefail

# Move to script directory (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo " GAIAI 自动日常机器人 - 一键运行脚本"
echo "========================================"

# Check Node & npm
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 node，请先安装 Node.js"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[错误] 未检测到 npm，请先安装 Node.js/npm"
  exit 1
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "[信息] 未发现 node_modules，正在安装依赖..."
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
else
  echo "[信息] 依赖已存在，跳过安装"
fi

# Ensure pk.txt and proxy.txt content
has_nonempty_lines() {
  # returns 0 if file has non-empty, non-comment lines; else 1
  [ -f "$1" ] && grep -E "^\s*[^#\s]" "$1" >/dev/null 2>&1
}

prompt_multiline_to_file() {
  local target_file="$1"
  local prompt_msg="$2"
  echo "$prompt_msg"
  echo "(逐行输入，每行一个，按 Ctrl+D 结束)"
  : > "$target_file"
  while IFS= read -r line; do
    echo "$line" >> "$target_file"
  done
  echo "[信息] 已写入: $target_file"
}

ensure_pk_file() {
  if [ -f pk_encrypted.txt ]; then
    echo "[提示] 检测到 pk_encrypted.txt，跳过明文私钥输入。"
    return 0
  fi
  if has_nonempty_lines pk.txt; then
    echo "[信息] 检测到有效 pk.txt，跳过输入。"
    return 0
  fi
  echo "\n[必填] 未检测到有效私钥文件。"
  prompt_multiline_to_file pk.txt "请粘贴私钥(不含0x)，每行一个："
}

ensure_proxy_file() {
  echo "\n[可选] 是否填写代理列表? (y/n) [n]: "
  read -r fill_proxy
  fill_proxy=${fill_proxy:-n}
  case "$fill_proxy" in
    y|Y)
      prompt_multiline_to_file proxy.txt "请输入代理(支持 http:// 或 socks5://)，每行一个："
      ;;
    *)
      echo "[信息] 跳过代理填写。"
      ;;
  esac
}

ensure_pk_file
ensure_proxy_file

# Handle decryption password if needed
if [ -f pk_encrypted.txt ] && [ ! -f pk.txt ]; then
  echo "\n[必填] 检测到加密私钥文件，需要解密密码。"
  read -rsp "请输入私钥解密密码: " DECRYPT_PASSWORD
  echo ""
  export DECRYPT_PASSWORD
  echo "[信息] 解密密码已设置，将在运行时自动使用。"
fi

# Determine run mode
# Supported values: start | encrypt-and-start | encrypt-only
RUN_MODE_ENV=${RUN_MODE:-}

choose_mode() {
  echo "\n请选择操作:"
  echo "  1) 直接运行 (npm start)"
  echo "  2) 先加密再运行 (npm run encrypt -> npm start)"
  echo "  3) 仅加密 (npm run encrypt)"
  read -rp "输入选择 (1/2/3) [1]: " choice
  choice=${choice:-1}
  case "$choice" in
    1) echo "start" ;;
    2) echo "encrypt-and-start" ;;
    3) echo "encrypt-only" ;;
    *) echo "start" ;;
  esac
}

if [ -z "$RUN_MODE_ENV" ]; then
  RUN_MODE=$(choose_mode)
else
  RUN_MODE="$RUN_MODE_ENV"
  echo "[信息] 检测到环境变量 RUN_MODE=$RUN_MODE"
fi

# Optional: quick hints
echo "[信息] 可通过设置 RUN_MODE 环境变量跳过交互:"
echo "       RUN_MODE=start            # 直接运行"
echo "       RUN_MODE=encrypt-and-start  # 加密后运行"
echo "       RUN_MODE=encrypt-only     # 仅加密"

run_encrypt() {
  if [ -f pk_encrypted.txt ]; then
    echo "[提示] 已检测到 pk_encrypted.txt，如需重新加密可继续..."
  fi
  if [ ! -f pk.txt ] && [ ! -f pk_encrypted.txt ]; then
    echo "[警告] 未发现 pk.txt 或 pk_encrypted.txt，可能无法加密或运行。"
  fi
  npm run encrypt
}

case "$RUN_MODE" in
  encrypt-and-start)
    run_encrypt
    echo "\n[信息] 启动机器人..."
    npm start
    ;;
  encrypt-only)
    run_encrypt
    ;;
  start|*)
    echo "\n[信息] 启动机器人..."
    npm start
    ;;
esac


