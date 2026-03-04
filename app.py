from flask import Flask, render_template, redirect, url_for 
from model.anomaly_detector import run_anomaly_detection
from rules.rule_engine import apply_rules
from summarizer.incident_summary import generate_summary
from rules.mitre_mapping import map_to_mitre
from response.playbook import recommend_response
from response.automation import simulate_response
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
        
        for _, row in df.iterrows(): # Go row by row in the DataFrame
            desc, rec = generate_summary(row) #takes one log entry (row) and returns: desc → Description text, rec → Recommended action
            summaries.append(desc)
            recommendations.append(rec) # saving the generated values into lists
            
            mitre_list.append(map_to_mitre(row['alert_type']))
            
            responses.append(recommend_response(row['severity']))
            
            incident_ids.append(generate_incident_id())
            
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
    df = apply_rules(df)
    df = enrich_alerts(df)

    df.to_csv("outputs/final_alerts.csv", index=False)

    return redirect(url_for("dashboard"))

if __name__ == "__main__":
    app.run(debug=True)
# This starts Flask server