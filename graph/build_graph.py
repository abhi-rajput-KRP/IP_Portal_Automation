from graph.schemas import WorkflowState
from graph.nodes import parse_excel, ocr_extract, deterministic_match, fuzzy_match, llm_resolve_ambiguous, validate_marks, dry_run_fill_and_annotate, await_faculty_review, generate_summary, log_audit, route_after_deterministic, route_after_fuzzy
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver

builder = StateGraph(WorkflowState)

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

builder.add_edge(START,"parse_excel")
builder.add_edge("parse_excel", "deterministic_match")
builder.add_conditional_edges("deterministic_match", route_after_deterministic, ["fuzzy_match", "validate_marks"])
builder.add_conditional_edges("fuzzy_match", route_after_fuzzy, ["llm_resolve_ambiguous", "validate_marks"])
builder.add_edge("llm_resolve_ambiguous", "validate_marks")
builder.add_edge("validate_marks", "dry_run_fill_and_annotate")
builder.add_edge("dry_run_fill_and_annotate", "await_faculty_review")
builder.add_edge("await_faculty_review", "generate_summary")
builder.add_edge("generate_summary", "log_audit")
builder.add_edge("log_audit", END)

checkpointer_cm= SqliteSaver.from_conn_string("workflow_checkpoints.db")
checkpointer=checkpointer_cm.__enter__()
graph = builder.compile(checkpointer=checkpointer)