#!/usr/bin/env bash
set -euo pipefail

# 定义常量
REPO_URL="https://github.com/sdohuajia/GaiAi-bot.git"
REPO_DIR="GaiAi-bot"

# 移动到脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo " GAIAI 自动日常机器人 - 一键运行脚本"
echo "========================================"

# 检查 Git 是否安装
if ! command -v git >/dev/null 2>&1; then
  echo "[错误] 未检测到 git，请先安装 Git"
  exit 1
fi

# 检查 Node.js 和 npm 是否安装
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 node，请先安装 Node.js"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[错误] 未检测到 npm，请先安装 Node.js/npm"
  exit 1
fi

# 检查 screen 是否安装
if ! command -v screen >/dev/null 2>&1; then
  echo "[错误] 未检测到 screen，请先安装 screen"
  echo "Ubuntu/Debian: sudo apt install screen"
  echo "CentOS/RHEL: sudo yum install screen"
  echo "macOS: brew install screen"
  exit 1
fi

# 拉取或更新 GitHub 仓库
if [ -d "$REPO_DIR" ]; then
  echo "[信息] 仓库 $REPO_DIR 已存在，尝试更新..."
  cd "$REPO_DIR"
  git pull origin main || {
    echo "[错误] 无法更新仓库，请检查网络或仓库状态"
    exit 1
  }
else
  echo "[信息] 克隆仓库 $REPO_URL..."
  git clone "$REPO_URL" "$REPO_DIR" || {
    echo "[错误] 克隆仓库失败，请检查网络或仓库地址"
    exit 1
  }
  cd "$REPO_DIR"
fi

# 安装依赖
if [ ! -d node_modules ]; then
  echo "[信息] 未发现 node_modules，正在安装依赖..."
  if [ -f package-lock.json ]; then
    npm ci || {
      echo "[错误] npm ci 安装依赖失败"
      exit 1
    }
  else
    npm install || {
      echo "[错误] npm install 安装依赖失败"
      exit 1
    }
  }
else
  echo "[信息] 依赖已存在，跳过安装"
fi

# 检查文件是否包含非空、非注释行
has_nonempty_lines() {
  [ -f "$1" ] && grep -E "^\s*[^#\s]" "$1" >/dev/null 2>&1
}

# 提示用户输入多行内容到文件
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

# 确保私钥文件存在
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

# 确保代理文件（可选）
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

# 确保私钥和代理文件
ensure_pk_file
ensure_proxy_file

# 处理解密密码（如果存在加密文件）
if [ -f pk_encrypted.txt ] && [ ! -f pk.txt ]; then
  echo "\n[必填] 检测到加密私钥文件，需要解密密码。"
  read -rsp "请输入私钥解密密码: " DECRYPT_PASSWORD
  echo ""
  export DECRYPT_PASSWORD
  echo "[信息] 解密密码已设置，将在运行时自动使用。"
fi

# 选择运行模式
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

# 检查 RUN_MODE 环境变量
RUN_MODE_ENV=${RUN_MODE:-}
if [ -z "$RUN_MODE_ENV" ]; then
  RUN_MODE=$(choose_mode)
else
  RUN_MODE="$RUN_MODE_ENV"
  echo "[信息] 检测到环境变量 RUN_MODE=$RUN_MODE"
fi

# 运行加密
run_encrypt() {
  if [ -f pk_encrypted.txt ]; then
    echo "[提示] 已检测到 pk_encrypted.txt，如需重新加密可继续..."
  fi
  if [ ! -f pk.txt ] && [ ! -f pk_encrypted.txt ]; then
    echo "[警告] 未发现 pk.txt 或 pk_encrypted.txt，可能无法加密或运行。"
  fi
  npm run encrypt || {
    echo "[错误] npm run encrypt 执行失败"
    exit 1
  }
}

# 检查是否已有 gaiAi screen 会话
if screen -list | grep -q "gaiAi"; then
  echo "[提示] 检测到已存在的 gaiAi screen 会话"
  echo "请选择操作:"
  echo "  1) 终止现有会话并重新启动"
  echo "  2) 连接到现有会话"
  echo "  3) 退出"
  read -rp "输入选择 (1/2/3) [1]: " screen_choice
  screen_choice=${screen_choice:-1}
  
  case "$screen_choice" in
    2)
      echo "[信息] 连接到现有 screen 会话..."
      screen -r gaiAi
      exit 0
      ;;
    3)
      echo "[信息] 退出脚本"
      exit 0
      ;;
    *)
      echo "[信息] 终止现有会话..."
      screen -S gaiAi -X quit 2>/dev/null || true
      ;;
  esac
fi

# 根据运行模式执行
case "$RUN_MODE" in
  encrypt-and-start)
    run_encrypt
    echo "\n[信息] 在 screen 会话中启动机器人..."
    screen -dmS gaiAi bash -c "npm start; exec bash"
    echo "[信息] 机器人已在 screen 会话 'gaiAi' 中启动"
    echo "[提示] 使用 'screen -r gaiAi' 连接到会话"
    echo "[提示] 使用 'screen -list' 查看所有会话"
    ;;
  encrypt-only)
    run_encrypt
    echo "[信息] 加密完成！"
    ;;
  start|*)
    echo "\n[信息] 在 screen 会话中启动机器人..."
    screen -dmS gaiAi bash -c "npm start; exec bash"
    echo "[信息] 机器人已在 screen 会话 'gaiAi' 中启动"
    echo "[提示] 使用 'screen -r gaiAi' 连接到会话"
    echo "[提示] 使用 'screen -list' 查看所有会话"
    ;;
esac

echo "[信息] 脚本执行完成！"
