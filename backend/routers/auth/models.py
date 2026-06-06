"""Pydantic models for Auth (extracted from auth.py)."""
from typing import Optional
from pydantic import BaseModel, EmailStr


class RegisterIn(BaseModel):
    email: EmailStr
    phone: str
    password: str
    full_name: str
    country: Optional[str] = None  # ISO 3166-1 alpha-2 (ex: "FR", "SN")
    city: Optional[str] = None
    accept_terms: Optional[bool] = True  # CGU acceptance

class VerifyOtpIn(BaseModel):
    user_id: str
    email_code: str
    phone_code: str

class LoginIn(BaseModel):
    identifier: str
    password: str

class BiometricLoginIn(BaseModel):
    biometric_token: str

class CreatePinIn(BaseModel):
    pin: str

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

class ChannelOtpIn(BaseModel):
    code: str

class UpdateMeIn(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None  # "light" | "dark" | "system"

class PhoneOtpIn(BaseModel):
    phone: str

class EmailChangeIn(BaseModel):
    new_email: str

class ChangePinIn(BaseModel):
    current_pin: str
    new_pin: str

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

class VerifyPinIn(BaseModel):
    pin: str
