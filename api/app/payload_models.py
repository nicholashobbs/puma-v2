from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class Link(BaseModel):
    linkName: str
    link: str

class Contact(BaseModel):
    firstName: str = ""
    lastName: str = ""
    email: str = ""
    phone: str = ""
    links: List[Link] = []

class Item(BaseModel):
    id: str
    fields: Dict[str, Any] = {}
    bullets: List[str] = []

class Section(BaseModel):
    id: str
    name: str
    fields: List[str] = []
    items: List[Item] = []

class Resume(BaseModel):
    contact: Contact
    summary: str = ""
    skills: List[str] = []
    sections: List[Section] = []
    meta: Dict[str, Any] = {}

class Snapshot(BaseModel):
    resume: Resume
    states: List[Dict[str, Any]] = []
    activeStateId: Optional[str] = None
    autosaveStateId: Optional[str] = None
    userTurns: List[Dict[str, Any]] = []
    step: int = 0
