# api/migrations/env.py
from sqlalchemy import engine_from_config, pool
from alembic import context
from pathlib import Path
import os
import sys

# Ensure we can import the 'app' package regardless of cwd:
# /app/migrations/env.py -> parent of migrations is the dir that contains 'app'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Alembic Config object
config = context.config

# Prefer DATABASE_URL from the environment to avoid config interpolation issues
env_url = os.environ.get("DATABASE_URL")
if env_url:
    config.set_main_option("sqlalchemy.url", env_url)

# Import your model metadata after sys.path is set
from app.models import Base  # noqa: E402
target_metadata = Base.metadata

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
