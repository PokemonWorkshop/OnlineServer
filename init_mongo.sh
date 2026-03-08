#!/bin/bash
set -e

echo "🔑 Initializing MongoDB users and database..."

mongosh <<EOF
use $DB_NAME;
if (db.getUser("$DB_USER") == null) {
  db.createUser({
    user: "$DB_USER",
    pwd:  "$DB_PSWD",
    roles: [{ role: "readWrite", db: "$DB_NAME" }]
  });
  print("✅ App user $DB_USER created with readWrite on $DB_NAME.");
} else {
  print("ℹ️  App user $DB_USER already exists, skipping.");
}
EOF

echo "✅ MongoDB initialization complete."
