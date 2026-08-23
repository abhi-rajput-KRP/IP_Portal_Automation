import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()
GEMINI_API_KEY= os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("Missng GEMINI_API_KEY in the environment")

llm=ChatGoogleGenerativeAI(
    model="gemma-4-26b-a4b-it",
    google_api_key=GEMINI_API_KEY
)