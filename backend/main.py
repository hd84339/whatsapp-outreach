from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def home():
    return {
        "message": "WhatsApp Outreach API is running"
    }