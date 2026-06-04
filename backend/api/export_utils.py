import pandas as pd
import json
import os

def clean_dataframe(df):
    """Applies all 10 fixes to the DataFrame."""
    df = df.copy()
    
    cols_to_drop = [
        'id', 'anomaly', 'anomaly_score', 'rule_bruteforce', 'rule_port_scan',
        'rule_traffic_spike', 'rule_triggered', 'bytes_zscore', 'ip_suspicious',
        'soc_playbook_action', 'automation_result', 'notes'
    ]
    df.drop(columns=[c for c in cols_to_drop if c in df.columns], inplace=True)
    
    # Map raw names if they exist to standard working names
    if 'incident_summary' in df.columns:
        df.rename(columns={'incident_summary': 'description'}, inplace=True)
    if 'recommended_action' in df.columns:
        df.rename(columns={'recommended_action': 'recommendation'}, inplace=True)
        
    # PROBLEM 4: TIMESTAMP HAS MICROSECONDS
    if 'timestamp' in df.columns:
        df['timestamp'] = df['timestamp'].astype(str).str.slice(0, 19)
    
    # PROBLEM 1: MITRE COLUMN IS A RAW JSON BLOB
    if 'mitre_technique' in df.columns:
        def parse_mitre(val):
            try:
                m = json.loads(val)
                if not isinstance(m, dict): m = {}
            except:
                m = {}
            mitigs = m.get('mitigations', [])
            if isinstance(mitigs, list):
                mitigs = ' | '.join(mitigs)
            else:
                mitigs = str(mitigs) if mitigs else ""
            
            return pd.Series({
                'mitre_technique_id': m.get('technique_id', ''),
                'mitre_technique_name': m.get('technique_name', ''),
                'mitre_tactic': m.get('tactic', ''),
                'mitre_tactic_id': m.get('tactic_id', ''),
                'mitre_sub_technique': m.get('sub_technique', ''),
                'mitre_sub_technique_name': m.get('sub_technique_name', ''),
                'mitre_url': m.get('mitre_url', ''),
                'mitre_detection_guidance': m.get('detection_guidance', ''),
                'mitre_mitigations': mitigs
            })
        
        mitre_cols = df['mitre_technique'].apply(parse_mitre)
        df = pd.concat([df, mitre_cols], axis=1)
        df.drop(columns=['mitre_technique'], inplace=True)
    
    # PROBLEM 2: DESCRIPTION COLUMN IS BROKEN
    if 'description' in df.columns:
        def fix_desc(row):
            sev = row.get('severity', 'Unknown')
            atype = row.get('alert_type', 'Unknown alert')
            src = row.get('source_ip', 'unknown source')
            dst = row.get('destination_ip', 'unknown destination')
            port = row.get('port', 'unknown port')
            
            import math
            port_disp = "unknown port" if pd.isna(port) else str(int(port) if isinstance(port, float) and not math.isnan(port) else port)

            desc = f"A {sev} {atype} was detected from source IP {src} targeting {dst} on port {port_disp}."
            
            details = []
            if 'failed_logins' in row and pd.notna(row['failed_logins']):
                details.append(f"failed_logins: {row['failed_logins']}")
            if 'bytes_transferred' in row and pd.notna(row['bytes_transferred']):
                details.append(f"bytes_transferred: {row['bytes_transferred']}")
                
            if details:
                desc += " (" + ", ".join(details) + ")"
            return desc
            
        df['description'] = df.apply(fix_desc, axis=1)
            
    # PROBLEM 3: RECOMMENDATION IS WRONG FOR CRITICAL ROWS
    if 'recommendation' in df.columns:
        def fix_rec(sev):
            s = str(sev).upper() if pd.notna(sev) else ""
            if s in ['CRITICAL', 'HIGH']:
                return "Immediately block the source IP and initiate incident response investigation."
            elif s == 'MEDIUM':
                return "Monitor activity closely and review related system logs."
            elif s == 'LOW':
                return "Perform manual log review to confirm anomalous behavior."
            else:
                return "No immediate action required."
                
        df['recommendation'] = df['severity'].apply(fix_rec)

    # PROBLEM 6: ESCALATION SHOWS True/False
    if 'escalation' in df.columns:
        def fix_esc(v):
            v_str = str(v).lower()
            if v_str in ('true', '1', 'yes'):
                return "Escalated to Tier-2"
            return "Under Review"
        df['escalation'] = df['escalation'].apply(fix_esc)
        
    # PROBLEM 7: CONFIDENCE HAS NO % SIGN
    if 'confidence' in df.columns:
        def fix_conf(v):
            if pd.isna(v):
                return ""
            try:
                val = float(v)
                if val == int(val):
                    return f"{int(val)}%"
                return f"{val:.1f}%"
            except:
                return f"{v}%" if v else ""
        df['confidence'] = df['confidence'].apply(fix_conf)

    # PROBLEM 10: ROWS NOT SORTED BY PRIORITY
    if 'severity' in df.columns:
        sev_map = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1, "Normal": 0}
        df['_sev_ord'] = df['severity'].map(sev_map).fillna(-1)
        if 'confidence' in df.columns:
            df['_conf_val'] = df['confidence'].astype(str).str.replace('%', '', regex=False).astype(float, errors='ignore')
            df['_conf_val'] = pd.to_numeric(df['_conf_val'], errors='coerce').fillna(0)
            df = df.sort_values(by=['_sev_ord', '_conf_val'], ascending=[False, False]).reset_index(drop=True)
            df.drop(columns=['_conf_val'], inplace=True)
        else:
            df = df.sort_values(by=['_sev_ord'], ascending=False).reset_index(drop=True)
        df.drop(columns=['_sev_ord'], inplace=True)
        
    # PROBLEM 9: NO ROW NUMBER
    df.insert(0, '#', range(1, len(df) + 1))

    # PROBLEM 5 & 8: COLUMN NAMES AND LOGICAL ORDER
    rename_map = {
        'incident_id': 'Incident ID',
        'timestamp': 'Timestamp',
        'source_ip': 'Source IP',
        'destination_ip': 'Destination IP',
        'port': 'Port',
        'alert_type': 'Alert Type',
        'severity': 'Severity',
        'risk_score': 'Risk Score',
        'confidence': 'Confidence (%)',
        'campaign_id': 'Campaign ID',
        'escalation': 'Escalation Status',
        'description': 'AI Summary',
        'recommendation': 'Recommended Action',
        'mitre_technique_id': 'MITRE Technique ID',
        'mitre_technique_name': 'MITRE Technique Name',
        'mitre_tactic': 'MITRE Tactic',
        'mitre_tactic_id': 'MITRE Tactic ID',
        'mitre_sub_technique': 'MITRE Sub-Technique',
        'mitre_sub_technique_name': 'MITRE Sub-Technique Name',
        'mitre_url': 'MITRE URL',
        'mitre_detection_guidance': 'MITRE Detection Guidance',
        'mitre_mitigations': 'MITRE Mitigations'
    }
    df.rename(columns=rename_map, inplace=True)
    
    # GROUPING
    ordered_cols = [
        '#', 'Incident ID', 'Timestamp',
        'Source IP', 'Destination IP', 'Port',
        'Alert Type', 'Severity', 'Risk Score', 'Confidence (%)',
        'Escalation Status', 'Campaign ID',
        'MITRE Technique ID', 'MITRE Technique Name', 'MITRE Tactic', 'MITRE Tactic ID',
        'MITRE Sub-Technique', 'MITRE Sub-Technique Name', 'MITRE URL', 
        'MITRE Detection Guidance', 'MITRE Mitigations',
        'AI Summary', 'Recommended Action'
    ]
    
    final_cols = [c for c in ordered_cols if c in df.columns]
    for c in df.columns:
        if c not in final_cols:
            final_cols.append(c)
            
    df = df[final_cols]
    return df

def export_csv(df_or_path, output_dir="outputs"):
    import os
    if isinstance(df_or_path, str):
        df = pd.read_csv(df_or_path)
    else:
        df = df_or_path
    os.makedirs(output_dir, exist_ok=True)
    cleaned_df = clean_dataframe(df)
    filepath = os.path.join(output_dir, "soc_alerts_export.csv")
    cleaned_df.to_csv(filepath, index=False)
    return filepath

def export_excel(df_or_path, output_dir="outputs"):
    import os
    if isinstance(df_or_path, str):
        df = pd.read_csv(df_or_path)
    else:
        df = df_or_path
    os.makedirs(output_dir, exist_ok=True)
    cleaned_df = clean_dataframe(df)
    filepath = os.path.join(output_dir, "soc_alerts_export.xlsx")
    cleaned_df.to_excel(filepath, index=False)
    return filepath

if __name__ == "__main__":
    if not os.path.exists("outputs"):
        os.makedirs("outputs")
    input_file = "soc_alerts_20260405_1847.csv"
    if os.path.exists(input_file):
        csv_str = export_csv(input_file)
        with open("outputs/cleaned_alerts.csv", "w", encoding="utf-8") as f:
            f.write(csv_str)
        print("Successfully processed the CSV. Output saved to outputs/cleaned_alerts.csv")
    else:
        print(f"Skipped manual run: {input_file} not found.")
