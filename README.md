# AI-Powered SOC Analyst Assistant

A simulation platform that mimics a Security Operations Center (SOC) workflow using machine learning, rule-based detection, and automated response logic.

The system ingests network logs, detects anomalies, applies security rules, generates incident summaries, maps alerts to MITRE ATT&CK techniques, and visualizes the results through a dashboard.

## Features

* ML-based anomaly detection using Isolation Forest
* Rule-based attack detection
* Hybrid detection architecture (ML + rules)
* MITRE ATT&CK mapping
* AI-style incident summaries
* Automated SOC playbook recommendations
* Incident escalation simulation
* Web dashboard for monitoring alerts

## Project Architecture

```
Logs
  ↓
Anomaly Detection (Isolation Forest)
  ↓
Rule Engine
  ↓
Severity Classification
  ↓
MITRE ATT&CK Mapping
  ↓
Incident Summary
  ↓
Escalation Logic
  ↓
Response Simulation
  ↓
SOC Dashboard
```

## Tech Stack

* Python
* Flask
* Scikit-Learn
* Pandas
* HTML / CSS
* Chart.js

## Installation

Clone the repository:

```
git clone https://github.com/sahillroy/ai-soc-analyst-assistant.git
```

Install dependencies:

```
pip install -r requirements.txt
```

Run the application:

```
python app.py
```

Open the dashboard:

```
http://127.0.0.1:5000
```

## Example Detection Output

Severity: High
Alert Type: Brute Force Attempt
MITRE Technique: T1110 – Brute Force

Summary:
Multiple failed login attempts detected from source IP targeting SSH service.

Recommended Action:
Block the source IP and review authentication logs.

## Future Improvements

* Real-time log streaming
* Threat intelligence integration
* Authentication for dashboard
* Containerized deployment (Docker)

## Author

Sahil Roy
