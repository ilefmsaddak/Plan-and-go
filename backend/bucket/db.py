import os
from mongoengine import connect, Document, StringField
from dotenv import load_dotenv
load_dotenv()

connect(
    db=os.environ.get("MONGO_DB"),
    host=os.environ.get("MONGO_URI")
)
print(f"Connected to MongoDB database")
