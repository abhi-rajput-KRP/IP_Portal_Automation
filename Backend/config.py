import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI


load_dotenv()
GEMINI_API_KEY= os.getenv("GEMINI_API_KEY")
FEATHERLESS_API_KEY= os.getenv("FEATHERLESS_API_KEY")

if not FEATHERLESS_API_KEY:
    raise RuntimeError("Missng FEATHERLESS_API_KEY in the environment")

if not GEMINI_API_KEY:
    raise RuntimeError("Missng GEMINI_API_KEY in the environment")

llm=ChatGoogleGenerativeAI(
    model="gemma-4-26b-a4b-it",
    google_api_key=GEMINI_API_KEY
)

vlm = ChatOpenAI(
    api_key=FEATHERLESS_API_KEY,
    model="Qwen/Qwen3-VL-4B-Instruct",
    base_url="https://api.featherless.ai/v1",
)