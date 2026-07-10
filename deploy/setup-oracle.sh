#!/bin/bash
# Story Lens - Oracle Cloud VPS Setup Script
# OS: Oracle Linux or Ubuntu on ARM (aarch64)
# Run as root: sudo bash setup-oracle.sh

set -e

DOMAIN="api.storylens.dmssolution.co.kr"
APP_DIR="/opt/storylens"
EMAIL="your-email@example.com"  # Change this for certbot

echo "============================================"
echo "  Story Lens - Oracle Cloud Setup"
echo "  IP: $(curl -s ifconfig.me)"
echo "============================================"
echo ""

# 1. System update
echo "[1/7] Updating system..."
if command -v apt-get &> /dev/null; then
    apt-get update && apt-get upgrade -y
    PKG_MGR="apt"
elif command -v dnf &> /dev/null; then
    dnf update -y
    PKG_MGR="dnf"
else
    echo "Unsupported package manager" && exit 1
fi

# 2. Install Docker
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Docker Compose plugin
if ! docker compose version &> /dev/null; then
    if [ "$PKG_MGR" = "apt" ]; then
        apt-get install -y docker-compose-plugin
    else
        dnf install -y docker-compose-plugin
    fi
fi

# Add current user to docker group
usermod -aG docker $SUDO_USER 2>/dev/null || true

echo "Docker: $(docker --version)"

# 3. Install Git
echo "[3/7] Installing Git..."
if ! command -v git &> /dev/null; then
    if [ "$PKG_MGR" = "apt" ]; then
        apt-get install -y git
    else
        dnf install -y git
    fi
fi

# 4. CRITICAL: Oracle Cloud iptables firewall
echo "[4/7] Configuring Oracle Cloud iptables..."

# Check if iptables has the default Oracle DROP rules
if iptables -L INPUT -n 2>/dev/null | grep -q "REJECT\|DROP"; then
    echo "  Found Oracle iptables rules, adding port 80 and 443..."

    # Add rules before the REJECT/DROP rule
    iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
    iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true

    # Save rules persistently
    if command -v netfilter-persistent &> /dev/null; then
        netfilter-persistent save
    elif [ -f /etc/iptables/rules.v4 ]; then
        iptables-save > /etc/iptables/rules.v4
    elif [ -d /etc/sysconfig ]; then
        iptables-save > /etc/sysconfig/iptables
    fi
    echo "  iptables rules saved"
else
    echo "  No restrictive iptables rules found, skipping"
fi

# Also check UFW
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    echo "  UFW rules added"
fi

echo ""
echo "  IMPORTANT: Also open ports 80 and 443 in Oracle Cloud Console!"
echo "  Network > Virtual Cloud Networks > Security Lists > Add Ingress Rules"
echo "  Source CIDR: 0.0.0.0/0, Dest Port: 80,443, Protocol: TCP"
echo ""

# 5. Create app directory
echo "[5/7] Creating app directory..."
mkdir -p "$APP_DIR"

# 6. Clone or prepare directory structure
echo "[6/7] Preparing directory..."
mkdir -p "$APP_DIR/deploy"
mkdir -p "$APP_DIR/backend"

# 7. Summary
echo "[7/7] Setup complete!"
echo ""
echo "============================================"
echo "  NEXT STEPS"
echo "============================================"
echo ""
echo "1. ORACLE CLOUD CONSOLE - Open ports:"
echo "   Networking > Virtual Cloud Networks > your-vcn"
echo "   > Security Lists > Default Security List"
echo "   > Add Ingress Rules:"
echo "     Source: 0.0.0.0/0  Port: 80   Protocol: TCP"
echo "     Source: 0.0.0.0/0  Port: 443  Protocol: TCP"
echo ""
echo "2. VERCEL DNS - Add A record:"
echo "   api.storylens.dmssolution.co.kr -> $(curl -s ifconfig.me)"
echo ""
echo "3. COPY FILES from your PC:"
echo "   scp -i your-key.pem -r backend/ ubuntu@$(curl -s ifconfig.me):$APP_DIR/"
echo "   scp -i your-key.pem -r deploy/ ubuntu@$(curl -s ifconfig.me):$APP_DIR/"
echo ""
echo "4. CREATE .env.production:"
echo "   cp $APP_DIR/deploy/.env.production.example $APP_DIR/deploy/.env.production"
echo "   nano $APP_DIR/deploy/.env.production"
echo ""
echo "5. START SERVICES:"
echo "   cd $APP_DIR/deploy"
echo "   docker compose --env-file .env.production up -d --build"
echo ""
echo "6. VERIFY:"
echo "   curl http://localhost:8000/health"
echo "   curl http://$(curl -s ifconfig.me)/health"
echo ""
echo "7. SSL CERTIFICATE (after DNS propagation):"
echo "   cd $APP_DIR/deploy"
echo "   docker compose --env-file .env.production run --rm certbot certonly \\"
echo "     --webroot -w /var/www/certbot \\"
echo "     -d $DOMAIN \\"
echo "     --email $EMAIL --agree-tos --no-eff-email"
echo ""
echo "8. ENABLE HTTPS:"
echo "   Edit $APP_DIR/deploy/nginx.conf"
echo "   - Uncomment the HTTPS server block"
echo "   - Uncomment the HTTP redirect"
echo "   - Comment out the HTTP proxy location block"
echo "   docker compose --env-file .env.production restart nginx"
echo ""
echo "9. INITIALIZE DATABASE AND AI DEFAULTS:"
echo "   docker compose --env-file .env.production run --rm init"
echo "   # No default user or password is created."
echo ""
echo "10. VERCEL ENV VAR:"
echo "    VITE_API_URL = https://$DOMAIN"
echo "    Then redeploy on Vercel"
echo ""
