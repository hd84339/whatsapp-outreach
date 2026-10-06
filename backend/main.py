from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
import json
import urllib.request
import os
from dotenv import load_dotenv
import google.generativeai as genai
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    name = Column(String, nullable=True)
    phone = Column(String, unique=True, index=True)

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_name = Column(String, default="Unknown")
    sender_phone = Column(String)
    text = Column(String)
    timestamp = Column(String)

Base.metadata.create_all(bind=engine)


# -------------------------
# Request Schema
# -------------------------

class ContactItem(BaseModel):
    name: str | None = None
    phone: str

class ContactRequest(BaseModel):
    contacts: list[ContactItem]

class BulkSendRequest(BaseModel):
    prompt: str
    numbers: list[str]

class IncomingMessage(BaseModel):
    sender_name: str
    sender_phone: str
    text: str


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
    seen = set()

    for item in data.contacts:
        if item.phone in seen:
            skipped.append(item.phone)
            continue

        existing = (
            db.query(Contact)
            .filter(Contact.phone == item.phone)
            .first()
        )

        if existing:
            skipped.append(item.phone)
            seen.add(item.phone)
        else:
            contact = Contact(name=item.name, phone=item.phone)
            db.add(contact)
            added.append(item.phone)
            seen.add(item.phone)

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
            "name": contact.name,
            "phone": contact.phone
        }
        for contact in contacts
    ]


@app.post("/incoming-message")
def save_incoming_message(msg: IncomingMessage):
    from datetime import datetime
    db = SessionLocal()
    new_msg = Message(
        sender_name=msg.sender_name,
        sender_phone=msg.sender_phone,
        text=msg.text,
        timestamp=datetime.now().strftime("%I:%M %p")
    )
    db.add(new_msg)
    db.commit()
    db.close()
    return {"status": "ok"}

@app.get("/messages")
def get_messages():
    db = SessionLocal()
    msgs = db.query(Message).order_by(Message.id.desc()).all()
    db.close()
    return msgs

@app.get("/export-vcard")
def export_vcard():
    db = SessionLocal()
    contacts = db.query(Contact).all()
    db.close()

    vcard_lines = []
    for c in contacts:
        contact_name = c.name if c.name else f"WA Contact {c.phone}"
        vcard_lines.append("BEGIN:VCARD")
        vcard_lines.append("VERSION:3.0")
        vcard_lines.append(f"FN:{contact_name}")
        vcard_lines.append(f"TEL;TYPE=CELL:{c.phone}")
        vcard_lines.append("END:VCARD")
    
    vcard_content = "\n".join(vcard_lines)
    
    return Response(
        content=vcard_content,
        media_type="text/vcard",
        headers={"Content-Disposition": "attachment; filename=whatsapp_contacts.vcf"}
    )

@app.post("/send-bulk")
def send_bulk(data: BulkSendRequest):
    db = SessionLocal()
    
    results = []
    
    for phone in data.numbers:
        # Try to find their name in our database
        contact = db.query(Contact).filter(Contact.phone == phone).first()
        name = contact.name if (contact and contact.name and contact.name != "Unknown") else "there"
        
        # This is where we will plug in the actual LLM API later.
        message = f"Hey {name}!\n\n{data.prompt}"
        
        req = urllib.request.Request(
            "http://localhost:3001/send",
            data=json.dumps({"number": phone, "message": message}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        try:
            with urllib.request.urlopen(req) as response:
                results.append({"phone": phone, "status": "sent"})
        except Exception as e:
            results.append({"phone": phone, "status": "error", "error": str(e)})

    db.close()
    return {"results": results}

# -------------------------
# AI Agent (Gemini)
# -------------------------

load_dotenv()
if "GEMINI_API_KEY" in os.environ:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])

def add_contact(name: str, phone: str) -> str:
    """Adds a new contact to the database. Use this when the user asks to save or add someone."""
    db = SessionLocal()
    existing = db.query(Contact).filter(Contact.phone == phone).first()
    if existing:
        db.close()
        return "Contact already exists."
    contact = Contact(name=name, phone=phone)
    db.add(contact)
    db.commit()
    db.close()
    return f"Successfully added {name} with phone {phone}."

def delete_contact(phone: str) -> str:
    """Deletes a contact from the database by phone number. Use this when the user asks to delete someone."""
    db = SessionLocal()
    contact = db.query(Contact).filter(Contact.phone == phone).first()
    if contact:
        db.delete(contact)
        db.commit()
        db.close()
        return f"Successfully deleted contact {phone}."
    db.close()
    return "Contact not found in the database."

def send_whatsapp_message(phone: str, message: str) -> str:
    """Sends a WhatsApp message to a specific phone number. Use this when the user asks to message someone."""
    req = urllib.request.Request(
        "http://localhost:3001/send",
        data=json.dumps({"number": phone, "message": message}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            return "Message sent successfully via WhatsApp."
    except Exception as e:
        return f"Failed to send message: {e}"

def get_all_contacts() -> str:
    """Retrieves a list of all contacts in the database. Use this to find contacts, count them, or search for a specific person's name or number."""
    db = SessionLocal()
    contacts = db.query(Contact).all()
    db.close()
    if not contacts:
        return "The contact list is empty."
    result = []
    for c in contacts:
        result.append(f"Name: {c.name}, Phone: {c.phone}")
    return "Here are all the contacts:\n" + "\n".join(result)

agent_chat = None
if "GEMINI_API_KEY" in os.environ:
    # We use enable_automatic_function_calling=True so Gemini executes the python functions for us automatically!
    agent_model = genai.GenerativeModel(
        model_name='gemini-3.8-flash', 
        tools=[add_contact, delete_contact, send_whatsapp_message, get_all_contacts]
    )
    agent_chat = agent_model.start_chat(enable_automatic_function_calling=True)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat_with_agent(data: ChatRequest):
    if not agent_chat:
        return {"reply": "Gemini API is not configured or missing from .env"}
    
    try:
        # Gemini will decide internally whether it needs to call a tool, call it, and return the final text to us.
        response = agent_chat.send_message(data.message)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"Error communicating with Gemini: {e}"}

