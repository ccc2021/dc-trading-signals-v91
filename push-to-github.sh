#!/bin/bash
# DC Trading Signals Pro v9.1 - GitHub 部署腳本

echo "════════════════════════════════════════════════════════════"
echo "  DC Trading Signals Pro v9.1"
echo "  GitHub 部署腳本"
echo "════════════════════════════════════════════════════════════"
echo ""

# 檢查 gh CLI
if ! command -v gh &> /dev/null; then
    echo "正在安裝 GitHub CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install gh
    else
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt update && sudo apt install gh -y
    fi
fi

# 登入 GitHub
echo ""
echo "[1/4] 登入 GitHub..."
gh auth status || gh auth login

# 創建倉庫
echo ""
echo "[2/4] 創建 GitHub 倉庫..."
REPO_NAME="dc-trading-signals-v91"

gh repo create $REPO_NAME --public --description "DC Trading Signals Pro v9.1 - 用戶自主訂閱系統" || true

# 設定遠端
echo ""
echo "[3/4] 設定遠端並推送..."
GITHUB_USER=$(gh api user -q .login)
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"

# 推送
git push -u origin main --force

echo ""
echo "[4/4] 完成！"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✅ 部署成功！"
echo ""
echo "  倉庫地址: https://github.com/$GITHUB_USER/$REPO_NAME"
echo "════════════════════════════════════════════════════════════"
