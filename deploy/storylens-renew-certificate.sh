#!/usr/bin/env bash
# Renew only the Story Lens API certificate used by host Nginx.
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'Run this script as root.' >&2
  exit 1
fi
if [[ $# -gt 1 || ( $# -eq 1 && $1 != --dry-run ) ]]; then
  echo 'Usage: storylens-renew-certificate.sh [--dry-run]' >&2
  exit 2
fi

exec 9>/run/lock/storylens-certbot.lock
flock -n 9 || exit 0

cert_file=/var/lib/docker/volumes/deploy_certbot-etc/_data/live/api.storylens.dmssolution.co.kr/fullchain.pem
[[ -f "$cert_file" ]] || { echo 'Story Lens certificate is missing.' >&2; exit 1; }
[[ -d /var/www/html ]] || { echo 'Nginx ACME webroot is missing.' >&2; exit 1; }
nginx -t
before=$(sha256sum "$cert_file" | cut -d ' ' -f 1)
options=()
if [[ ${1:-} == --dry-run ]]; then options+=(--dry-run); fi

docker run --rm --name storylens-certbot-renew \
  -v deploy_certbot-etc:/etc/letsencrypt \
  -v deploy_certbot-var:/var/lib/letsencrypt \
  -v /var/www/html:/var/www/certbot \
  certbot/certbot renew \
  --cert-name api.storylens.dmssolution.co.kr \
  --webroot -w /var/www/certbot --non-interactive "${options[@]}"

after=$(sha256sum "$cert_file" | cut -d ' ' -f 1)
if [[ ${1:-} != --dry-run && "$before" != "$after" ]]; then
  nginx -t
  systemctl reload nginx
fi
