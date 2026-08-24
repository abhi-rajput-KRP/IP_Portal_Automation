import json
import re
from datetime import datetime, timezone
from rapidfuzz import fuzz
import base64
from langchain_core.messages import HumanMessage
from langgraph.types import interrupt
from graph.prompts import build_prompt, OCR_prompt
from graph.schemas import WorkflowState, LLMClassificationList
from config import llm, vlm
import time
import os
import psycopg
from dotenv import load_dotenv

# Setting up Neon-Postgres DB
load_dotenv()
db_url = os.getenv("DATABASE_URL")


def ingest_input(state: WorkflowState) -> dict:
    # decide branch based on input_type — set here, routing happens in conditional edge
    return {}

COLUMN_ALIASES = {
    "enrolment_no": ["enrolment no", "enrolment number", "enrollment no","enrollment number", "roll no", "roll number", "enr no","enlorrment number"],
    "name": ["name", "student name", "full name"],
    "value": ["marks", "marks obtained", "internal marks", "score", "marks alloted", "marks allotted"],
}


def parse_excel(state: WorkflowState) -> dict:
    raw_rows = state["raw_records"]  
    parse_errors = []
    records = []
    seen_enrolment_nos = {}

    for idx, row in enumerate(raw_rows):
        normalized_row = normalize_row_keys(row)

        enrolment_no = clean_enrolment_no(normalized_row.get("enrolment_no"))
        name = clean_name(normalized_row.get("name"))
        value = normalized_row.get("value")

        if not enrolment_no and not name:
            continue  

        if not enrolment_no or not name:
            parse_errors.append({
                "row_number": idx + 2,
                "reason": f"Missing {'enrolment number' if not enrolment_no else 'name'}",
                "raw_row": row,
            })
            continue

        if enrolment_no in seen_enrolment_nos:
            parse_errors.append({
                "row_number": idx + 2,
                "reason": f"Duplicate enrolment number '{enrolment_no}' (also on row {seen_enrolment_nos[enrolment_no]})",
                "raw_row": row,
            })
            continue

        seen_enrolment_nos[enrolment_no] = idx + 2
        records.append({
            "enrolment_no": enrolment_no,
            "name": name,
            "value": value.strip() if isinstance(value, str) else value,
            "source_row": idx + 2,
        })

    return {
        "raw_records": records,
        "unresolved": state.get("unresolved", []) + [
            {**e, "status": "parse_error"} for e in parse_errors
        ],
    }


def normalize_row_keys(row: dict) -> dict:
    """Map whatever column headers XLSX.js produced (as dict keys) to standard field names."""
    normalized = {}
    for key, value in row.items():
        key_clean = key.strip().lower()
        for standard_name, aliases in COLUMN_ALIASES.items():
            if key_clean in aliases:
                normalized[standard_name] = value
                break
    return normalized


def clean_enrolment_no(value) -> str:
    ENROLMENT_NO_LENGTH = 11
    if value is None or value == "":
        return ""
    cleaned = str(value).strip()
    if cleaned.endswith(".0"):
        cleaned = cleaned[:-2]
    
    if cleaned.isdigit():
        cleaned = cleaned.zfill(ENROLMENT_NO_LENGTH)
    return cleaned


def clean_name(value) -> str:
    if value is None or value == "":
        return ""
    return " ".join(str(value).strip().split())

def encode_image(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def ocr_extract(state: WorkflowState) -> dict:
    image_path = state["image_path"]
    base64_image = encode_image(image_path)

    message = HumanMessage(
        content=[
            {"type": "text", "text": OCR_prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
        ]
    )

    try:
        result = vlm.invoke([message])
        raw_text = result.content.strip()
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()
        rows = json.loads(raw_text)
    except Exception as e:
        print(f"[OCR failed]: {type(e).__name__}: {e}")
        return {"raw_records": [], "unresolved": state.get("unresolved", [])}

    parse_errors = []
    records = []
    seen_enrolment_nos = {}

    for idx, row in enumerate(rows):
        enrolment_no = clean_enrolment_no(row.get("enrolment_no", ""))
        name = clean_name(row.get("name", ""))
        value = row.get("marks", "")

        if not enrolment_no and not name:
            continue
        if not enrolment_no or not name:
            parse_errors.append({
                "row_number": idx + 1,
                "reason": f"OCR could not read {'enrolment number' if not enrolment_no else 'name'}",
                "raw_row": row,
            })
            continue
        if enrolment_no in seen_enrolment_nos:
            parse_errors.append({
                "row_number": idx + 1,
                "reason": f"Duplicate enrolment number '{enrolment_no}'",
                "raw_row": row,
            })
            continue

        seen_enrolment_nos[enrolment_no] = idx + 1
        records.append({
            "enrolment_no": enrolment_no,
            "name": name,
            "value": value.strip() if isinstance(value, str) else value,
            "source_row": idx + 1,
        })

    return {
        "raw_records": records,
        "unresolved": state.get("unresolved", []) + [
            {**e, "status": "parse_error"} for e in parse_errors
        ],
    }

def deterministic_match(state: WorkflowState) -> dict:
    matched, leftover = [], []
    portal_lookup = {s["enrolment_no"]: s for s in state["portal_students"]}
    for r in state["raw_records"]:
        if r["enrolment_no"] in portal_lookup:
            matched.append({**r, 
            "confidence": 1.0, 
            "reason": "Exact enrolment match",
            "field_selector": portal_lookup[r["enrolment_no"]]["field_selector"]
            })
        else:
            leftover.append(r)
    return {"matched": matched, "ambiguous": leftover}

def fuzzy_match(state: WorkflowState) -> dict:
    still_ambiguous = []
    newly_matched = list(state["matched"])

    for r in state["ambiguous"]:
        scored = []
        for s in state["portal_students"]:
            name_score = fuzz.ratio(r["name"].lower(), s["name"].lower())
            enroll_score = fuzz.ratio(r["enrolment_no"], s["enrolment_no"])
            combined = (name_score * 0.7) + (enroll_score * 0.3)
            scored.append((combined, s))

        scored.sort(key=lambda x: x[0], reverse=True)
        best_score, best_student = scored[0]
        second_score = scored[1][0] if len(scored) > 1 else 0

        MARGIN_THRESHOLD = 10
        is_confident = best_score > 90 and (best_score - second_score) >= MARGIN_THRESHOLD

        if is_confident:
            newly_matched.append({
                **r,
                "confidence": best_score / 100,
                "reason": f"Fuzzy match ({best_score:.0f}%), no close competing candidate",
                "field_selector": best_student["field_selector"]
            })
        else:
            still_ambiguous.append({
                **r,
                "candidates": [s for _, s in scored[:3]],
                "reason": "Multiple students with similar names — needs disambiguation",
            })

    return {"matched": newly_matched, "ambiguous": still_ambiguous}


def llm_resolve_ambiguous(state: WorkflowState) -> dict:
    if not state["ambiguous"]:
        return {}
    test_ambiguous = state["ambiguous"]
    resolved, unresolved = call_llm_batch(test_ambiguous, state["portal_students"])
    return {
        "matched": state["matched"] + resolved,
        "unresolved": unresolved,
    }


def call_llm_batch(ambiguous_records, portal_students):
    prompt = build_prompt.format(ambiguous_records=ambiguous_records, portal_students=portal_students)
    structured_output_llm=llm.with_structured_output(LLMClassificationList)
    for attempt in range(2):
        try:
            response = structured_output_llm.invoke(prompt)
            break
        except Exception  as e:
            print(f"[LLM call failed, attempt {attempt + 1}/{2}]: {e}")
            if attempt == 2:
                return [], ambiguous_records
            time.sleep(2 ** attempt)
    results = response.records

    resolved, unresolved = [], []
    CONFIDENCE_THRESHOLD = 0.8

    portal_lookup = {s["enrolment_no"]: s for s in portal_students}
    original_lookup = {r["enrolment_no"]: r for r in ambiguous_records}

    for item in results:
        original = original_lookup.get(item.source_enrolment_no)
        if original is None:
            continue

        if item.matched_enrolment_no and item.confidence>= CONFIDENCE_THRESHOLD:
            matched_student = portal_lookup.get(item.matched_enrolment_no)
            resolved.append({
                **original,
                "enrolment_no": item.matched_enrolment_no,
                "confidence": item.confidence,
                "reason": item.reason,
                "field_selector": matched_student["field_selector"]
            })
        else:
            unresolved.append({
                **original,
                "confidence": item.confidence,
                "reason": item.reason,
            })

    return resolved, unresolved

MAX_MARKS = 40  
ABSENT_MARKERS = {"ab", "absent", "-", "n/a", "na", "nil", ""}

def validate_marks(state: WorkflowState) -> dict:
    validated = []
    validation_failures = []

    for r in state["matched"]:
        raw_value = r["value"]
        result = {**r}

        normalized = normalize_and_check(raw_value)

        if normalized["status"] == "valid":
            result["value"] = normalized["value"]
            result["validation_flag"] = None
            validated.append(result)

        elif normalized["status"] == "absent":
            result["value"] = None 
            result["validation_flag"] = "absent"
            validated.append(result)

        else:
            result["value"] = None
            result["validation_flag"] = "invalid"
            result["reason"] = normalized["reason"]
            validation_failures.append(result)

    return {
        "validated": validated,
        "unresolved": state.get("unresolved", []) + validation_failures,
    }


def normalize_and_check(raw_value) -> dict:
    if raw_value is None:
        return {"status": "invalid", "reason": "No marks value found"}

    cleaned = str(raw_value).strip().lower()

    if cleaned in ABSENT_MARKERS:
        return {"status": "absent"}

    match = re.match(r"^(\d+(\.\d+)?)$", cleaned)
    if not match:
        return {"status": "invalid", "reason": f"Could not parse '{raw_value}' as a number"}

    value = float(match.group(1))

    if value < 0:
        return {"status": "invalid", "reason": f"Negative marks ({value}) not allowed"}
    if value > MAX_MARKS:
        return {"status": "invalid", "reason": f"Marks ({value}) exceed maximum ({MAX_MARKS})"}

    return {"status": "valid", "value": value}

def dry_run_fill_and_annotate(state: WorkflowState) -> dict:
    instructions = []
    for r in state["validated"]:
        color = "#e6ffe6" if r["confidence"] > 0.9 else "#e3c18d"
        instructions.append({
            **r,
            "status": "confirmed" if color == "#e6ffe6" else "flagged",
            "bg_color": color,
            "icon": "check" if color == "#e6ffe6" else "question",
        })
    for r in state["unresolved"]:
        instructions.append({
            **r,
            "status": "empty",
            "bg_color": "#ed6060",
            "icon": "flag",
            "reason": r.get("reason", "No confident match found"),
        })
    return {"field_instructions": instructions}

def generate_summary(state: WorkflowState) -> dict:
    confirmed = sum(1 for f in state["field_instructions"] if f["status"] == "confirmed")
    flagged = sum(1 for f in state["field_instructions"] if f["status"] == "flagged")
    empty = sum(1 for f in state["field_instructions"] if f["status"] == "empty")
    text = f"{confirmed} confirmed, {flagged} flagged for review, {empty} left for manual entry."
    return {"summary_text": text}


def log_audit(state: WorkflowState) -> dict:
    try:
    # Establish connection to Neon DB
        with psycopg.connect(db_url) as conn:
        # Open a cursor to perform database operations
            with conn.cursor() as cur:
            # Query the current Postgres version
                cur.execute("""
                CREATE TABLE IF NOT EXISTS audit_runs (
                id SERIAL PRIMARY KEY,
                thread_id TEXT,
                timestamp TEXT,
                total_records INTEGER,
                auto_matched INTEGER,
                manually_resolved INTEGER,
                summary_text TEXT,
                field_instructions_json TEXT,
                final_values_json TEXT
            )
            """)
                field_instructions = state.get("field_instructions", [])
                final_values = state.get("final_field_values", [])
            
                auto_matched = sum(1 for f in field_instructions if f.get("status") == "confirmed")
                manually_resolved = sum(1 for f in field_instructions if f.get("status") in ("flagged", "empty"))
            
                cur.execute("""
                    INSERT INTO audit_runs (
                        thread_id, timestamp, total_records, auto_matched, 
                        manually_resolved, summary_text, field_instructions_json, final_values_json
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    state.get("thread_id", "unknown"),
                    datetime.now(timezone.utc).isoformat(),
                    len(field_instructions),
                    auto_matched,
                    manually_resolved,
                    state.get("summary_text", ""),
                    json.dumps(field_instructions),
                    json.dumps(final_values),
                ))
            
    except Exception as e:
        print(f"Failed to connect to the database: {e}")

    return {} 

def route_input(state: WorkflowState) -> str:
    return "ocr_extract" if state["input_type"] == "image" else "parse_excel"

def route_after_deterministic(state: WorkflowState) -> str:
    return "fuzzy_match" if state["ambiguous"] else "validate_marks"

def route_after_fuzzy(state: WorkflowState) -> str:
    return "llm_resolve_ambiguous" if state["ambiguous"] else "validate_marks"

def await_faculty_review(state: WorkflowState) -> dict:
    faculty_input = interrupt({"field_instructions": state["field_instructions"]})
    return {"final_field_values": faculty_input["final_field_values"]}