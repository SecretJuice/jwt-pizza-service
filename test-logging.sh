#!/usr/bin/env bash

set -euo pipefail

account_id="${GRAFANA_ACCOUNT_ID:-}"
api_key="${GRAFANA_API_KEY:-}"
log_url="${GRAFANA_LOG_URL:-https://logs-prod-042.grafana.net/loki/api/v1/push}"
count="${COUNT:-100}"
sleep_seconds="${SLEEP_SECONDS:-3}"

if [[ -z "$account_id" || -z "$api_key" ]]; then
  cat <<'EOF'
Usage:
  GRAFANA_ACCOUNT_ID=... GRAFANA_API_KEY=... ./test-logging.sh

Optional:
  GRAFANA_LOG_URL=https://.../loki/api/v1/push
  COUNT=10
  SLEEP_SECONDS=1
EOF
  exit 1
fi

auth_header="Authorization: Basic $(printf '%s' "${account_id}:${api_key}" | base64)"

for ((i = 1; i <= count; i++)); do
  if (( RANDOM % 2 )); then
    level="warn"
  else
    level="info"
  fi

  timestamp="$(date +%s%N)"
  message="$(printf '{"name":"hacker","email":"d@jwt.com","password":"****","user_id":"44","traceID":"9bc86924d069e9f8ccf09192763f1120","iteration":%d,"level":"%s"}' "$i" "$level")"
  escaped_message="${message//\\/\\\\}"
  escaped_message="${escaped_message//\"/\\\"}"
  payload="$(printf '{"streams":[{"stream":{"component":"jwt-pizza-curltest","level":"%s","type":"http-req"},"values":[["%s","%s"]]}]}' "$level" "$timestamp" "$escaped_message")"

  response="$(
    curl --silent --show-error \
    -X POST \
    -H "$auth_header" \
    -H "Content-Type: application/json" \
    --data-raw "$payload" \
    "$log_url"
  )"

  echo "response $i/$count ($level):"
  printf '%s\n' "$response"

  if (( i < count )); then
    sleep "$sleep_seconds"
  fi
done
