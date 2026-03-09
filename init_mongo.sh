#!/bin/bash
# init_mongo.sh
#
# Runs once on first container startup (empty data directory).
# Creates the application database user with readWrite access.
#
# Required environment variables (injected by Docker Compose):
#   DB_NAME  — name of the application database
#   DB_USER  — application user username
#   DB_PSWD  — application user password

set -e

echo "[init_mongo] Creating application user for database: ${DB_NAME}"

mongosh --quiet \
  -u "${MONGO_INITDB_ROOT_USERNAME}" \
  -p "${MONGO_INITDB_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  <<EOF

use ${DB_NAME};

const userExists = db.getUser("${DB_USER}") !== null;

if (!userExists) {
  db.createUser({
    user: "${DB_USER}",
    pwd:  "${DB_PSWD}",
    roles: [{ role: "readWrite", db: "${DB_NAME}" }]
  });
  print("[init_mongo] User '${DB_USER}' created with readWrite on '${DB_NAME}'.");
} else {
  print("[init_mongo] User '${DB_USER}' already exists, skipping.");
}

EOF

echo "[init_mongo] Initialization complete."
