from app.schemas.common import ORMModel

class TaskOut(ORMModel):
    id: int
    name: str

class TodoOut(ORMModel):
    id: int
    title: str
