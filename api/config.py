from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    recruiter_email: str
    recruiter_password_hash: str
    hunar_api_key: str = ""
    hunar_agent_id: str
    company_name: str = "Hunar"
    backend_base_url: str  # public URL of this backend, used for webhook callback_config


    class Config:
        env_file = ".env"

settings = Settings()