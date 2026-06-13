from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    # --- Core infrastructure (required at runtime) ---
    database_url: str
    secret_key: str
    algorithm: str = 'HS256'
    access_token_expire_minutes: int = 480
    cors_origins: str = 'http://localhost:3000,http://localhost'
    timezone: str = 'Asia/Tehran'

    # --- Bootstrap admin account (seeded by scripts/seed_admin.py) ---
    # Defaults are intentionally simple so the app boots for local dev; in any
    # real deployment these MUST be overridden through the environment / .env.
    admin_username: str = 'admin'
    admin_password: str = 'Admin123'
    admin_full_name: str = 'مدیر سیستم'
    admin_department: str = 'مدیریت'


settings = Settings()
