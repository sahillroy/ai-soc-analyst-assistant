import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Groq uses an OpenAI-compatible API — just change base_url and key name.
# No extra library needed, openai package works directly with Groq.
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)


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
            model="llama-3.3-70b-versatile",  # Groq: fast + free, supports JSON mode
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a cybersecurity SOC analyst. "
                        "Always respond with a valid json object only. "
                        "No markdown, no code fences, no extra text."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,              # low temp = consistent, structured output
            max_tokens=300,
            # Note: response_format json_object is NOT supported by all Groq models
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
        raise Exception("LLM call failed: Malformed JSON output")
    except Exception as e:
        raise Exception(f"LLM call failed: {type(e).__name__}")

def generate_tactical_summary(alerts_data: list) -> str:
    """
    Generates a single global AI Tactical Summary for the entire dataset.
    Aggregates indicators and makes ONE LLM call to provide dataset-wide context.
    """
    if not alerts_data:
        return "No alerts to summarize."

    from collections import Counter
    
    # 1. Extract Aggregated Telemetry for Prompt context
    total = len(alerts_data)
    ips = Counter([d.get("source_ip") for d in alerts_data if d.get("source_ip")])
    types = Counter([d.get("alert_type") for d in alerts_data if d.get("alert_type")])
    high_risk = len([d for d in alerts_data if d.get("severity") in ["High", "Critical"]])
    
    top_ips = ", ".join([f"{ip} ({count})" for ip, count in ips.most_common(3)])
    top_types = ", ".join([f"{t} ({c})" for t, c in types.most_common(3)])

    prompt = f"""You are a Lead SOC Analyst. Summarize the following tactical situation for the security dashboard.

    Dataset Metrics:
    - Total Alerts: {total}
    - High/Critical Threats: {high_risk}
    - Top Offending IPs: {top_ips}
    - Primary Threat Vectors: {top_types}

    Respond with exactly 2 sentences of high-level analyst context.
    Focus on the severity, the primary actor source, and the immediate impact.
    No JSON, just the summary text."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a concise cybersecurity SOC lead summary generator."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=150,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[!] Tactical LLM failed: {e}. Falling back to rule-based.")
        return generate_rule_based_tactical_summary(alerts_data)

def generate_rule_based_tactical_summary(data: list) -> str:
    """
    Fallback generator for a dataset-level tactical summary if LLM batch processing fails.
    Analyzes list of alert dicts for top IPs, most frequent alerts to build a rule-based abstract.
    """
    if not data:
        return "No alerts to summarize."
    
    from collections import Counter
    
    total_alerts = len(data)
    ips = Counter([d.get("source_ip") for d in data if d.get("source_ip")])
    alerts = Counter([d.get("alert_type") for d in data if d.get("alert_type")])
    
    top_ip = ips.most_common(1)[0][0] if ips else "Unknown"
    top_alert = alerts.most_common(1)[0][0] if alerts else "Unknown"
    
    return f"Tactical Overview: Dataset contains {total_alerts} active threats. The most frequent indicator is '{top_alert}'. Primary threat actor origin identified at IPv4 {top_ip}."