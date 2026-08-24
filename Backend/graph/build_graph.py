from graph.schemas import WorkflowState
from graph.nodes import ingest_input, parse_excel, ocr_extract, deterministic_match, fuzzy_match, llm_resolve_ambiguous, validate_marks, dry_run_fill_and_annotate, await_faculty_review, generate_summary, log_audit, route_after_deterministic, route_after_fuzzy, route_input

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
import os
from dotenv import load_dotenv

# Setting up Neon-Postgres DB
load_dotenv()
DB_URI = os.getenv("DATABASE_URL")

builder = StateGraph(WorkflowState)

builder.add_node("ingest_input", ingest_input)
builder.add_node("parse_excel", parse_excel)
builder.add_node("ocr_extract", ocr_extract)
builder.add_node("deterministic_match", deterministic_match)
builder.add_node("fuzzy_match", fuzzy_match)
builder.add_node("llm_resolve_ambiguous", llm_resolve_ambiguous)
builder.add_node("validate_marks", validate_marks)
builder.add_node("dry_run_fill_and_annotate", dry_run_fill_and_annotate)
builder.add_node("await_faculty_review", await_faculty_review)
builder.add_node("generate_summary", generate_summary)
builder.add_node("log_audit", log_audit)

builder.add_edge(START,"ingest_input")
builder.add_conditional_edges("ingest_input", route_input, ["ocr_extract", "parse_excel"])
builder.add_edge("ocr_extract", "deterministic_match")
builder.add_edge("parse_excel", "deterministic_match")
builder.add_conditional_edges("deterministic_match", route_after_deterministic, ["fuzzy_match", "validate_marks"])
builder.add_conditional_edges("fuzzy_match", route_after_fuzzy, ["llm_resolve_ambiguous", "validate_marks"])
builder.add_edge("llm_resolve_ambiguous", "validate_marks")
builder.add_edge("validate_marks", "dry_run_fill_and_annotate")
builder.add_edge("dry_run_fill_and_annotate", "await_faculty_review")
builder.add_edge("await_faculty_review", "generate_summary")
builder.add_edge("generate_summary", "log_audit")
builder.add_edge("log_audit", END)

checkpointer_cm = PostgresSaver.from_conn_string(DB_URI)
checkpointer = checkpointer_cm.__enter__()

# Initialize tables required by LangGraph on Neon (runs automatically if missing)
checkpointer.setup()

graph = builder.compile(checkpointer=checkpointer)