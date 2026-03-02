#!/bin/sh
set -eu

echo "Preparing database..."

if [ -d prisma/migrations ] && [ -n "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d -print -quit)" ]; then
  until npx prisma migrate deploy; do
    echo "Database not ready for migrations yet, retrying in 2 seconds..."
    sleep 2
  done
else
  until npx prisma db push --skip-generate; do
    echo "Database not ready for schema sync yet, retrying in 2 seconds..."
    sleep 2
  done
fi

exec npm run start
