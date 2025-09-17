#!/bin/bash
set -e

echo "🔑 Initializing MongoDB users and database..."

mongosh <<EOF
# Create app user with read/write access only to DB_NAME
use $DB_NAME;
if (db.getUser("$DB_USER") == null) {
  db.createUser({
    user: "$DB_USER",
    pwd: "$DB_PSWD",
    roles: [ { role: "readWrite", db: "$DB_NAME" } ]
  });
  print("✅ App user $DB_USER created with read/write on $DB_NAME.");
} else {
  print("ℹ️ App user $DB_USER already exists, skipping creation.");
}
EOF

echo "✅ MongoDB initialization complete."

# use admin;

# # Create root user if it doesn't exist
# if (db.getUser("$DB_ROOT") == null) {
#   db.createUser({
#     user: "$DB_ROOT",
#     pwd: "$DB_CRED",
#     roles: [ { role: "root", db: "admin" } ]
#   });
#   print("✅ Root user $DB_ROOT created.");
# } else {
#   print("ℹ️ Root user $DB_ROOT already exists, skipping creation.");
# }