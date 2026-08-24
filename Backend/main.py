from fastapi import UploadFile, File, Form, FastAPI
import shutil
import os
import json
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

@app.get("/")
def health_check():
    return {"status": "alive"}

# @app.post("/api/run-workflow")
# async def run_workflow(payload: dict):
#     thread_id = str(uuid.uuid4())
#     config = {"configurable": {"thread_id": thread_id}}

#     initial_state = {
#         "input_type": payload["input_type"],
#         "raw_records": payload["records"],
#         "portal_students": payload["portal_students"],
#     }
#     result = graph.invoke(initial_state, config=config)

#     return {
#         "thread_id": thread_id,
#         "field_instructions": result.get("field_instructions", []),
#         "summary_text": result.get("summary_text", ""),
#     }

# @app.post("/api/resume-workflow")
# async def resume_workflow(payload: dict):
#     config = {"configurable": {"thread_id": payload["thread_id"]}}
#     result = graph.invoke(
#         Command(resume={"final_field_values": payload["final_field_values"]}),
#         config=config,
#     )
#     return {
#         "status": "submitted",
#         "summary_text": result.get("summary_text", ""),
#     }

@app.post("/api/run-workflow")
async def run_workflow(
    input_type: str = Form(...),
    records: str = Form(None),           # JSON string of parsed Excel rows, for excel path
    portal_students: str = Form(...),     # JSON string, always required
    image: UploadFile = File(None),  
    weightage_config: str = Form(None)     # only present for image path
):
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "thread_id": thread_id,
        "input_type": input_type,
        "portal_students": json.loads(portal_students),
        "weightage_config": json.loads(weightage_config) if weightage_config else None
    }

    if input_type == "excel":
        if not records:
            return {"error": "records is required for input_type=excel"}
        initial_state["raw_records"] = json.loads(records)

    elif input_type == "image":
        if not image:
            return {"error": "image file is required for input_type=image"}
        os.makedirs("/tmp/uploads", exist_ok=True)
        image_path = f"/tmp/uploads/{thread_id}_{image.filename}"
        with open(image_path, "wb") as f:
            shutil.copyfileobj(image.file, f)
        initial_state["image_path"] = image_path

    else:
        return {"error": f"Unknown input_type: {input_type}"}

    result = graph.invoke(initial_state, config=config)

    return {
        "thread_id": thread_id,
        "field_instructions": result.get("field_instructions", []),
        "summary_text": result.get("summary_text", ""),
    }