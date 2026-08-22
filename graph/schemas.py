from typing import TypedDict, Literal, Optional, List, Dict
from pydantic import BaseModel

class FieldRecord(TypedDict):
    enrolment_no: str
    name: str
    value: Optional[float]
    field_selector: str
    status: Literal["confirmed", "flagged", "empty"]
    confidence: float
    reason: str
    border_color: str
    icon: str

class WorkflowState(TypedDict):
    input_type: str
    file_path: str
    records:List[Dict]
    raw_records: list          
    portal_students: List[Dict]     
    matched: list
    ambiguous: list
    unresolved: list
    validated: list
    field_instructions: list[FieldRecord]
    final_field_values: list   
    summary_text: str


class LLMClassification(BaseModel):
  source_enrolment_no: str
  source_name: str
  matched_enrolment_no: str
  matched_name:str
  confidence: float
  reason: str

class LLMClassificationList(BaseModel):
  records:List[LLMClassification]