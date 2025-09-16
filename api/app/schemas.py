from pydantic import BaseModel

class ItemIn(BaseModel):
    name: str

class ItemOut(BaseModel):
    id: int
    name: str
