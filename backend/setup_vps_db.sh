#!/bin/bash
set -e

echo "Configurando PostgreSQL para ANCU..."

sudo -u postgres psql <<EOF
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ancu_user') THEN
      CREATE ROLE ancu_user WITH LOGIN PASSWORD 'ancu_secure_password_2026';
   ELSE
      ALTER ROLE ancu_user WITH PASSWORD 'ancu_secure_password_2026';
   END IF;
END
\$\$;
EOF

if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw ancu_db; then
    sudo -u postgres createdb -O ancu_user ancu_db
    echo "Base de datos ancu_db creada."
fi

sudo -u postgres psql -d ancu_db -c "GRANT ALL PRIVILEGES ON DATABASE ancu_db TO ancu_user;"
sudo -u postgres psql -d ancu_db -c "GRANT ALL ON SCHEMA public TO ancu_user;"
sudo -u postgres psql -d ancu_db -c "ALTER SCHEMA public OWNER TO ancu_user;"

echo "PostgreSQL configurado con éxito para ancu_user."
