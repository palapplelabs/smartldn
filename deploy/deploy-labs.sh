#!/usr/bin/env bash
# Deploys the committed HEAD to labs.palapple.com/smartldn.
#   HOST=user@your-server SSH_KEY=path/to/key deploy/deploy-labs.sh
set -euo pipefail
HOST="${HOST:?set HOST to user@server}"
KEY="${SSH_KEY:?set SSH_KEY to the server key}"
DIR=/home/opc/labs/smartldn

git archive --format=tar HEAD | ssh -i "$KEY" "$HOST" "tar -x -C $DIR"
ssh -i "$KEY" "$HOST" "cd $DIR && set -a && . ~/.config/smartldn/env && set +a \
  && npm ci --no-audit --no-fund && npm run build \
  && pm2 startOrReload deploy/pm2.config.cjs --update-env && pm2 save"
curl -fsS https://labs.palapple.com/smartldn/api/streetworks/sns
