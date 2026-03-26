import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _parse_mitre_field(mitre_raw) -> str:
    """
    pipeline.py stores mitre_technique as json.dumps(dict).
    This safely extracts a readable string regardless of format.
    """
    if isinstance(mitre_raw, dict):
        tid = mitre_raw.get("technique_id", "")
        tname = mitre_raw.get("technique_name", "")
        return f"{tid} - {tname}".strip(" -")

    if isinstance(mitre_raw, str):
        try:
            parsed = json.loads(mitre_raw)
            tid = parsed.get("technique_id", "")
            tname = parsed.get("technique_name", "")
            return f"{tid} - {tname}".strip(" -")
        except (json.JSONDecodeError, AttributeError):
            return mitre_raw  # already a plain string like "T1110 - Brute Force"

    return "Unknown"


def _strip_json_fences(text: str) -> str:
    """
    GPT models sometimes wrap JSON in ```json ... ``` markdown fences.
    Strip them before parsing.
    """
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # Drop first line (```json or ```) and last line (```)
        text = "\n".join(lines[1:-1]).strip()
    return text


def generate_llm_summary(row) -> dict:
    """
    Generate an AI-powered SOC incident summary using OpenAI.

    Returns a dict with keys: summary, intent, action.
    Falls back to a static response for Low/Medium severity (cost control)
    and on any API or parsing failure.
    """

    # --- Cost gate: skip LLM for low-priority alerts ---
    if row.get("severity") not in ["High", "Critical"]:
        return {
            "summary": "Low priority alert. No significant risk indicators detected.",
            "intent": "Likely benign or low-impact activity.",
            "action": "Monitor and log. Review during next analyst shift.",
        }

    mitre_display = _parse_mitre_field(row.get("mitre_technique", "Unknown"))

    prompt = f"""You are a senior SOC analyst reviewing a security alert.

Analyze the alert below and respond ONLY with a valid JSON object.
Do not include markdown, backticks, or any explanation — only raw JSON.

Required format:
{{
  "summary": "2-sentence plain-English description of what happened and why it is suspicious",
  "intent": "Most likely attacker objective based on the alert type and indicators",
  "action": "Single most important immediate action the analyst should take"
}}

Alert details:
Source IP      : {row.get('source_ip', 'Unknown')}
Destination    : {row.get('destination_ip', 'Unknown')}:{row.get('port', 'Unknown')}
Alert type     : {row.get('alert_type', 'Unknown')}
Severity       : {row.get('severity', 'Unknown')}
Risk score     : {row.get('risk_score', 'N/A')}
Failed logins  : {row.get('failed_logins', 0)}
Bytes xferred  : {row.get('bytes_transferred', 0)}
Confidence     : {round(float(row.get('confidence', 0)), 1)}%
MITRE technique: {mitre_display}
Campaign ID    : {row.get('campaign_id', 'standalone')}
Timestamp      : {row.get('timestamp', 'Unknown')}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",          # cheap + fast; swap to gpt-4o for higher quality
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a cybersecurity SOC analyst. "
                        "Always respond with valid JSON only. No markdown, no extra text."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,              # low temp = consistent, structured output
            max_tokens=300,
            response_format={"type": "json_object"},  # forces JSON mode (gpt-4o-mini supports this)
        )

        raw_text = response.choices[0].message.content
        clean_text = _strip_json_fences(raw_text)
        result = json.loads(clean_text)

        # Validate required keys exist
        for key in ("summary", "intent", "action"):
            if key not in result:
                result[key] = "Not provided."

        return result

    except json.JSONDecodeError:
        return {
            "summary": "LLM returned malformed JSON. Raw output could not be parsed.",
            "intent": "Unknown",
            "action": "Manual investigation required.",
        }
    except Exception as e:
        return {
            "summary": f"LLM call failed: {type(e).__name__}.",
            "intent": "Unknown",
            "action": "Manual investigation required.",
        }