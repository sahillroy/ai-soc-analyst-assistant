import pandas as pd
import re
import os

def parse_logs(filepath: str) -> pd.DataFrame:
    """
    Intelligently reads and parses different raw log formats into a base DataFrame
    ready for the column mapper.
    """
    if filepath.endswith('.csv'):
        df = pd.read_csv(filepath)
    elif filepath.endswith('.json'):
        df = pd.read_json(filepath)
    else:
        # Fallback to CSV text parsing
        df = pd.read_csv(filepath)

    cols = set(df.columns)

    # 1. AWS VPC Flow Log format
    if {'srcaddr', 'dstaddr', 'dstport', 'packets', 'bytes'}.issubset(cols):
        # Convert numeric protocol to named
        if 'protocol' in df.columns:
            proto_map = {6: 'TCP', 17: 'UDP', 1: 'ICMP'}
            df['protocol'] = df['protocol'].map(proto_map).fillna(df['protocol'])
            
    # 2. Windows Event Log format
    elif {'TimeCreated', 'IpAddress', 'TargetServerName', 'DestinationPort'}.issubset(cols):
        if 'FailureReason' in df.columns:
            # If there's a FailureReason, mark as failed login
            df['failed_logins'] = df['FailureReason'].notna() & (df['FailureReason'] != '')
            df['failed_logins'] = df['failed_logins'].astype(int)
            
    # 3. Wireshark CSV format
    elif {'Time', 'Source', 'Destination', 'Length', 'Info'}.issubset(cols):
        pass # The column_mapper will handle simple renames
        
    # 4. Raw Syslog Format
    elif {'timestamp', 'hostname', 'message'}.issubset(cols) and 'source_ip' not in cols:
        # Try to extract IPs and ports from string message
        ip_pattern = r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
        
        # very basic syslog extraction: first IP = source, port 22 fallback
        extracted_ips = df['message'].str.extractall(ip_pattern)
        if not extracted_ips.empty:
            # Get first matched IP per message row
            first_ips = extracted_ips.xs(0, level='match')[0]
            df['source_ip'] = first_ips
            df['destination_ip'] = '10.0.0.5' # Hard fallback for internal network
            df['port'] = 22 # Assuming SSH attempts in syslog

    return df
