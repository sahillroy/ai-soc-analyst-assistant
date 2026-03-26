from flask import Flask, render_template, redirect, url_for 
from backend.detection.severity_engine import assign_severity_scored
from backend.detection.rule_engine import assign_alert_type, apply_rules
from backend.enrichment.ip_reputation import check_ip_reputation
from backend.detection.ml.anomaly_detector import run_anomaly_detection
from backend.enrichment.llm_summarizer import generate_llm_summary
from backend.enrichment.incident_summary import generate_summary
from backend.enrichment.mitre import map_to_mitre
from backend.response.playbook import recommend_response
from backend.response.automation import simulate_response
from backend.detection.correlator import correlate_alerts
from backend.core.database import engine
import pandas as pd
import os
import uuid
# Flask -> Used to create web app . render_template -> Sends data to HTML page

# Incident ID Generator
def generate_incident_id():
    return "INC-" + str(uuid.uuid4())[:8].upper()
# Every alert will have Incident Id (INC-8D3B77A2)

#Generate Summaries
def enrich_alerts(df):
        summaries = []
        recommendations = []
        mitre_list = []
        responses = []
        incident_ids = []
        escalations = []
        automation_logs = []
        countries = []
        ip_flags = []
        
        for _, row in df.iterrows(): # Go row by row in the DataFrame
            try:
                llm_output = generate_llm_summary(row)
            
                summaries.append(llm_output.get("summary", "No summary"))
                recommendations.append(llm_output.get("action", "No action"))
            
            except Exception:
                # fallback (important)
                desc, rec = generate_summary(row)
                summaries.append(desc)
                recommendations.append(rec)
            
            mitre_list.append(map_to_mitre(row['alert_type']))
            
            responses.append(recommend_response(row['severity']))
            
            incident_ids.append(generate_incident_id())
            
            intel = check_ip_reputation(row['source_ip'])

            country = intel.get('country', 'Unknown')
            is_suspicious = intel.get('is_suspicious', False)
            
            countries.append(country)
            ip_flags.append(is_suspicious)
            
            # alert escalation logic. It decides Should this alert be handled by Tier-1 analysts, or escalated to Tier-2?
            if row['severity'] == "High" and row['confidence'] > 85:
                escalation = "Escalated to Tier-2"
            else:
                escalation = "Under Review"
                
            escalations.append(escalation)
            
            automation_logs.append(simulate_response(row))
    
        # creating new columns inside your dataframe
        df['incident_summary'] = summaries
        df['recommended_action'] = recommendations
        df['mitre_technique'] = mitre_list
        df['soc_playbook_action'] = responses
        df['incident_id'] = incident_ids
        df['escalation'] = escalations
        df['automation_result'] = automation_logs
        statuses = ["New"] * len(df)
        df['status'] = statuses #Every alert should automatically get status "New"
        df['ip_country'] = countries
        df['ip_suspicious'] = ip_flags
        
        return df

app = Flask(__name__) # initializes the web application

@app.route("/") #When user visits IP (http://127.0.0.1:5000/) Run dashboard() function
def dashboard():

    if not os.path.exists("outputs/final_alerts.csv"):
        return "Run analysis first at /run"
    # Checks whether the alert file exists. This file is generated after running detection/analysis.
    # If it doesn’t exist → user must first trigger /run

    df = pd.read_csv("outputs/final_alerts.csv")
    # Loads final processed alerts into a Pandas DataFrame.

    total_alerts = len(df) # Counts total number of alerts.
    high = len(df[df['severity'] == "High"])
    medium = len(df[df['severity'] == "Medium"])
    low = len(df[df['severity'] == "Low"])
    # filters rows based on severity level.

    top_ips = df['source_ip'].value_counts().head(5) # Find Top 5 Suspicious IPs

    return render_template(
        "dashboard.html",
        total_alerts=total_alerts,
        high=high,
        medium=medium,
        low=low,
        top_ips=top_ips,
        alerts=df.to_dict(orient="records") # converts DataFrame into list of dictionaries
    )
    # Send Data to HTML Template
    

@app.route("/run")
def run_analysis():
    run_anomaly_detection("data/logs.csv")

    df = pd.read_csv("outputs/suspicious_logs.csv")

    # Step 1 — Rule detection
    df = apply_rules(df)
    
    # Step 2 — Risk scoring (NEW ENGINE)
    df = assign_severity_scored(df)
    
    # Step 3 — Alert classification
    df = assign_alert_type(df)
    
    df = correlate_alerts(df)
    
    # Step 4 — Enrichment (uses severity now)
    df = enrich_alerts(df)


    df.to_sql("alerts", engine, if_exists="replace", index=False)

    return redirect(url_for("dashboard"))

if __name__ == "__main__":
    app.run(debug=True)
# This starts Flask server