from typing import Any, Dict, Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

JsonDict = Dict[str, Any]

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore", populate_by_name=True)

# ----- Versions -----

class VersionBase(ORMModel):
    name: Optional[str] = None

class VersionCreate(VersionBase):
    # Accept both keys from clients; we’ll prefer `payload` if both are present.
    payload: Optional[JsonDict] = None
    data: Optional[JsonDict] = None

class VersionRename(ORMModel):
    name: str

class VersionReplace(ORMModel):
    # Same rule: accept either, prefer payload
    payload: Optional[JsonDict] = None
    data: Optional[JsonDict] = None

class VersionShort(ORMModel):
    id: UUID
    name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class VersionOut(VersionShort):
    payload: JsonDict
