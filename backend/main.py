from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker

app = FastAPI()


# -------------------------
# Database
# -------------------------

DATABASE_URL = "sqlite:///./contacts.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# -------------------------
# Contact Model
# -------------------------


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True)


Base.metadata.create_all(bind=engine)


# -------------------------
# Request Schema
# -------------------------

class ContactRequest(BaseModel):
    numbers: list[str]


# -------------------------
# Routes
# -------------------------

@app.get("/")
def home():
    return {
        "message": "WhatsApp Outreach API is running"
    }


@app.post("/contacts")
def create_contacts(data: ContactRequest):

    db = SessionLocal()

    added = []
    skipped = []

    for number in data.numbers:

        existing = (
            db.query(Contact)
            .filter(Contact.phone == number)
            .first()
        )

        if existing:
            skipped.append(number)
        else:
            contact = Contact(phone=number)

            db.add(contact)

            added.append(number)

    db.commit()
    db.close()

    return {
        "message": "Contacts processed",
        "added": added,
        "skipped": skipped
    }


@app.get("/contacts")
def get_contacts():

    db = SessionLocal()

    contacts = db.query(Contact).all()

    db.close()

    return [
        {
            "id": contact.id,
            "phone": contact.phone
        }
        for contact in contacts
    ]
