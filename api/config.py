from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    recruiter_email: str
    recruiter_password_hash: str
    hunar_api_key: str = ""  # will be used from Phase 2 onward

    class Config:
        env_file = ".env"

settings = Settings()