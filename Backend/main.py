from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.types import Command
from graph.build_graph import graph
import uuid

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/run-workflow")
async def run_workflow(payload: dict):
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "input_type": payload["input_type"],
        "raw_records": payload["records"],
        "portal_students": payload["portal_students"],
    }
    result = graph.invoke(initial_state, config=config)

    return {
        "thread_id": thread_id,
        "field_instructions": result.get("field_instructions", []),
        "summary_text": result.get("summary_text", ""),
    }

@app.post("/api/resume-workflow")
async def resume_workflow(payload: dict):
    config = {"configurable": {"thread_id": payload["thread_id"]}}
    result = graph.invoke(
        Command(resume={"final_field_values": payload["final_field_values"]}),
        config=config,
    )
    return {
        "status": "submitted",
        "summary_text": result.get("summary_text", ""),
    }