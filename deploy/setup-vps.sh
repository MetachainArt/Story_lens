#!/bin/bash
# Story Lens Backend - VPS Setup Script
# Run as root on Ubuntu 22.04+
# Usage: bash setup-vps.sh

set -e

DOMAIN="api.storylens.dmssolution.co.kr"
APP_DIR="/opt/storylens"

echo "=== Story Lens Backend Setup ==="

# 1. Update system
echo "[1/6] Updating system..."
apt-get update && apt-get upgrade -y

# 2. Install Docker
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Install docker-compose plugin
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

echo "Docker version: $(docker --version)"

# 3. Open firewall ports (works for both Ubuntu UFW and Oracle iptables)
echo "[3/6] Configuring firewall..."

# UFW (Hostinger Ubuntu)
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    echo "UFW rules added"
fi

# iptables (Oracle Cloud - critical!)
if iptables -L INPUT -n 2>/dev/null | grep -q "DROP"; then
    iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
    iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
    netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
    echo "iptables rules added (Oracle Cloud)"
fi

# 4. Create app directory
echo "[4/6] Setting up application directory..."
mkdir -p "$APP_DIR"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1. Copy project files to VPS:"
echo "   scp -r deploy/ backend/ user@YOUR_VPS_IP:$APP_DIR/"
echo ""
echo "2. On VPS, create .env.production:"
echo "   cp $APP_DIR/deploy/.env.production.example $APP_DIR/deploy/.env.production"
echo "   nano $APP_DIR/deploy/.env.production"
echo ""
echo "3. Start the application:"
echo "   cd $APP_DIR/deploy && docker compose --env-file .env.production up -d --build"
echo ""
echo "4. Get SSL certificate:"
echo "   docker compose --env-file .env.production run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --email your@email.com --agree-tos"
echo ""
echo "5. Enable HTTPS in nginx.conf, then:"
echo "   docker compose --env-file .env.production restart nginx"
