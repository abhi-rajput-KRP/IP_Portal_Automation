build_prompt="""You are matching student exam records from a faculty's Excel file against
the official portal's student list for the same class. Some records could not be matched
automatically by enrolment number or simple fuzzy name matching.

For each unmatched record below, find the correct student from the candidate list,
if one genuinely exists. Consider common name variations (e.g., "Mohd." = "Mohammed",
reordered names, missing middle names, minor spelling differences). Do NOT guess a match
if you are not reasonably confident — it is better to mark it unresolved than to guess wrong.

UNMATCHED RECORDS (from faculty's file):
{ambiguous_records}

CANDIDATE STUDENTS (from portal's official list):
{portal_students}

For each unmatched record, respond with a JSON array. Each element must have exactly this shape:
{{
  "source_enrolment_no": "<enrolment_no from the unmatched record>",
  "source_name": "<name from the unmatched record>",
  "matched_enrolment_no": "<enrolment_no of matched portal student, or null if unresolved>",
  "matched_name": "<name of matched portal student, or null if unresolved>",
  "confidence": <float between 0 and 1>,
  "reason": "<one short sentence explaining reason for the confidence score>"
}}

Respond with ONLY the JSON array. No preamble, no markdown formatting, no additional text."""