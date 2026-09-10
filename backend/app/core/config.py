from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, overridable via environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="LYZA_", extra="ignore")

    # Base Adresse Nationale (IGN Géoplateforme) — geocoding, no API key required.
    ban_base_url: str = "https://data.geopf.fr/geocodage/"

    # API Géorisques (BRGM) — risques naturels et technologiques, no API key required.
    georisques_base_url: str = "https://georisques.gouv.fr/api/v1/"

    # Default search radius (metres) used for the point-based Géorisques queries.
    default_radius_m: int = 500
    max_radius_m: int = 2000

    http_timeout_s: float = 8.0


settings = Settings()
