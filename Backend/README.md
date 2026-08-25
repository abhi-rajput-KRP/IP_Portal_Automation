# IP Portal Automation - Backend Service

The Backend Service is an intelligent workflow orchestration engine built with FastAPI and LangGraph. It processes student marks from ingested spreadsheet data, performs multi-tiered deterministic, fuzzy, and LLM-assisted matching against live student portal rosters, enforces mark validation constraints, and manages Human-in-the-Loop (HITL) review cycles backed by PostgreSQL audit persistence.

---

## Architectural Overview

The backend is built around a stateful LangGraph workflow graph that separates matching into deterministic, phonetic/heuristic, and generative AI stages. State checkpointing is maintained in PostgreSQL via `PostgresSaver`, enabling execution suspension and resumption during faculty review.

```mermaid
flowchart TD
    Start([Workflow Start]) --> ParseExcel[parse_excel]
    ParseExcel --> Deterministic[deterministic_match]
    
    Deterministic -->|Ambiguous Records Found| Fuzzy[fuzzy_match]
    Deterministic -->|All Exact Matched| Validate[validate_marks]
    
    Fuzzy -->|Remaining Ambiguity| LLM[llm_resolve_ambiguous]
    Fuzzy -->|Fuzzy Resolved| Validate
    
    LLM --> Validate
    Validate --> DryRun[dry_run_fill_and_annotate]
    DryRun --> AwaitReview[await_faculty_review - Interrupt]
    
    AwaitReview -->|Resume with Faculty Edits| Summary[generate_summary]
    Summary --> LogAudit[log_audit - Neon PostgreSQL]
    LogAudit --> End([Workflow Complete])
```

---

## Pipeline Nodes and Processing Logic

### 1. Ingestion and Header Normalization (`parse_excel`)
- Maps heterogeneous spreadsheet headers to canonical fields using alias dictionaries (`enrolment_no`, `name`, `value`).
- Cleans and standardizes enrollment numbers with 11-digit zero padding (`clean_enrolment_no`).
- Normalizes student names by collapsing excessive whitespace.
- Identifies malformed rows, missing critical fields, or duplicate enrollment numbers, routing them to the unresolved queue with descriptive parse errors.

### 2. Deterministic Matching (`deterministic_match`)
- Performs exact 1:1 lookup matching against the scraped portal student roster using enrollment numbers.
- Records with an exact match are assigned a confidence score of `1.0` and assigned the target DOM selector (`field_selector`).
- Unmatched records are forwarded to the ambiguous matching queue.

### 3. Heuristic Fuzzy Matching (`fuzzy_match`)
- Evaluates ambiguous records against portal candidates using RapidFuzz string distance algorithms.
- Computes a weighted composite similarity score:
  $$\text{Score} = (\text{Name Ratio} \times 0.7) + (\text{Enrollment Ratio} \times 0.3)$$
- Automatically confirms matches if the composite score exceeds `90%` and leads the runner-up candidate by a safety margin of at least `10%`.
- If competing candidates exist within the margin, the record is flagged for LLM disambiguation along with its top 3 candidate options.

### 4. Generative AI Disambiguation (`llm_resolve_ambiguous`)
- Submits remaining ambiguous records and candidate lists to Google Generative AI (`gemma-4-26b-a4b-it` / Gemini).
- Resolves complex real-world discrepancies including abbreviated honorifics/names (e.g., "Mohd." vs. "Mohammed"), transposed first/last names, missing middle names, and phonetic variations.
- Enforces strict structured JSON schema responses using Pydantic (`LLMClassificationList`).
- Confirms matches meeting a confidence threshold of `0.80` or higher; otherwise categorizes records as unresolved for manual entry.

### 5. Mark Validation and Normalization (`validate_marks`)
- Normalizes marks input and parses absent indicators (`ab`, `absent`, `-`, `n/a`, `nil`).
- Validates numeric boundaries against the maximum allowable marks (0 to 40).
- Flags out-of-bounds values or unparseable text as validation errors.

### 6. UI Annotation Generation (`dry_run_fill_and_annotate`)
- Generates visual rendering metadata (`FieldRecord`) consumed by the client extension:
  - **Confirmed (`#e6ffe6`)**: Exact or high-confidence matches (confidence > 0.90).
  - **Flagged (`#eec890`)**: Moderate confidence or heuristic matches requiring visual confirmation.
  - **Empty / Flagged Error (`#ee9090`)**: Unresolved records or invalid marks requiring manual entry.

### 7. Human-in-the-Loop Review (`await_faculty_review`)
- Executes a LangGraph `interrupt`, pausing graph execution and saving intermediate state to the PostgreSQL checkpointer.
- Awaits faculty inspection, manual corrections, and final submission through the extension.

### 8. Metrics and Audit Logging (`generate_summary` & `log_audit`)
- Calculates aggregate metrics (total processed, auto-matched, flagged, manual entries).
- Automatically initializes and logs audit run records into the Neon PostgreSQL `audit_runs` table with thread ID, timestamp, summary counts, and full JSON payloads.

---

## File Structure

```text
Backend/
├── graph/
│   ├── build_graph.py     # StateGraph assembly, conditional routing, and PostgresSaver setup
│   ├── nodes.py           # Pipeline processing nodes, matching logic, and DB operations
│   ├── prompts.py         # Structured prompt templates for LLM disambiguation
│   └── schemas.py         # Pydantic models and TypedDict state definitions
├── config.py              # Environment configuration and Google GenAI LLM client initialization
├── main.py                # FastAPI REST application endpoints and CORS configuration
├── requirements.txt       # Python dependencies and locked package versions
└── .env                   # Environment variable secrets (API keys, Database URLs)
```

---

## API Reference

### Health Check
- **Endpoint**: `GET /`
- **Description**: Verifies service availability.
- **Response**:
  ```json
  {
    "status": "alive"
  }
  ```

### Run Matching Workflow
- **Endpoint**: `POST /api/run-workflow`
- **Description**: Ingests spreadsheet records and live portal students, executes graph processing up to the review interrupt, and returns visual field instructions.
- **Request Body** (`multipart/form-data`):
  - `input_type` (string): e.g., `"excel"` or `"image"`
  - `records` (stringified JSON, optional): Parsed Excel rows
  - `portal_students` (stringified JSON, required): Roster scraped from the portal
  - `image` (file, optional): Uploaded mark sheet image
  - `weightage_config` (stringified JSON, optional): Weightage components configuration
- **Response Body**:
  ```json
  {
    "thread_id": "8f8832a7-57cb-4b2a-a921-998811223344",
    "field_instructions": [
      {
        "enrolment_no": "00112345678",
        "name": "John Doe",
        "value": 35.0,
        "field_selector": "#agent-field-0",
        "status": "confirmed",
        "confidence": 1.0,
        "reason": "Exact enrolment match",
        "bg_color": "#e6ffe6",
        "icon": "check"
      }
    ],
    "summary_text": "1 confirmed, 0 flagged for review, 0 left for manual entry."
  }
  ```

### Resume Workflow and Persist Audit
- **Endpoint**: `POST /api/resume-workflow`
- **Description**: Resumes the paused workflow thread with final confirmed field values, executes summary calculations, and writes to the audit log.
- **Request Body**:
  ```json
  {
    "thread_id": "8f8832a7-57cb-4b2a-a921-998811223344",
    "final_field_values": [
      {
        "enrolment_no": "00112345678",
        "field_selector": "#agent-field-0",
        "value": "35"
      }
    ]
  }
  ```
- **Response Body**:
  ```json
  {
    "status": "submitted",
    "summary_text": "1 confirmed, 0 flagged for review, 0 left for manual entry."
  }
  ```

---

## Database Schema (PostgreSQL)

The service utilizes PostgreSQL for both LangGraph state checkpointing and historical audit logging. The audit schema is automatically created on execution:

```sql
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
);
```

---

## Environment Configuration

Create a `.env` file in the `Backend/` directory with the following configuration keys:

```env
GEMINI_API_KEY=your_google_gemini_api_key
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
FEATHERLESS_API_KEY = your_featherless_api_key
```

- `GEMINI_API_KEY`: API key for Google Generative AI (Gemini / Gemma models).
- `DATABASE_URL`: Connection string for PostgreSQL (e.g., Neon serverless PostgreSQL instance).
- `FEATHERLESS_API_KEY`: API key for Featherless AI.

---

## Setup and Installation~

### 1. Prerequisites
- Python 3.10 or higher
- Access to a PostgreSQL database (e.g., Neon)
- Google Gemini API key

### 2. Create and Activate Virtual Environment

**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the Application Server

Run the development server using Uvicorn:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The API service will be accessible at `http://127.0.0.1:8000`. Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.
