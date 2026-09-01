from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str | None = None
    role: UserRole = UserRole.farmer


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    phone: str | None
    role: UserRole
    language: str

    class Config:
        from_attributes = True
