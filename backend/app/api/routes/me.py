from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.schemas.user import UserOut
from app.models.user import User

router = APIRouter(tags=['me'])

@router.get('/me', response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
