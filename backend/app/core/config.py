from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str
    secret_key: str
    algorithm: str = 'HS256'
    access_token_expire_minutes: int = 480
    cors_origins: str = 'http://localhost:3000,http://localhost'
    timezone: str = 'Asia/Tehran'

settings = Settings()
