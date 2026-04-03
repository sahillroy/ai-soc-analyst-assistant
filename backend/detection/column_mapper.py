import pandas as pd
from typing import Tuple, Dict

def map_columns(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """
    Detects common column name variants in arbitrary log files and renames them
    to standard schema. Also fills missing required fields with defaults.
    
    Returns:
        (mapped_df, mapping_report)
    """
    # Define mapping rules. Key = standard_name, Value = list of accepted aliases
    MAPPING_RULES = {
        'source_ip': ['src_ip', 'src', 'source', 'sourceip', 'srcip'],
        'destination_ip': ['dst_ip', 'dest_ip', 'dst', 'destination', 'destip', 'dstip'],
        'bytes_transferred': ['bytes', 'bytessent', 'bytes_sent', 'size', 'length'],
        'failed_logins': ['failures', 'login_failures', 'failedlogins', 'failed', 'bad_logins'],
        'port': ['dst_port', 'dport', 'dstport', 'dest_port'],
        'timestamp': ['time', 'datetime', 'date', 'ts', 'timecreated', 'start'],
        'protocol': ['proto']
    }

    report = {}
    
    # 1. Standardise incoming columns (strip whitespace, lowercase for comparison)
    original_cols = list(df.columns)
    normalised_cols = {}
    for col in original_cols:
        norm = str(col).strip().lower()
        normalised_cols[norm] = col
    
    new_columns_map = {}

    # 2. Iterate through rules and match
    for standard_name, aliases in MAPPING_RULES.items():
        # Include the standard name itself in the search so we preserve it if it already exists
        all_variants = [standard_name] + aliases
        
        for variant in all_variants:
            if variant in normalised_cols:
                actual_col = normalised_cols[variant]
                if actual_col != standard_name:
                    new_columns_map[actual_col] = standard_name
                    report[actual_col] = standard_name
                # Remove from pool so we don't map twice
                del normalised_cols[variant]
                break

    # Apply renames
    df = df.rename(columns=new_columns_map)

    # 3. Apply defaults for required numeric/categorical fields that couldn't be mapped
    if 'failed_logins' not in df.columns:
        df['failed_logins'] = 0
    
    if 'protocol' not in df.columns:
        df['protocol'] = 'TCP'

    # If missing port, default to 0
    if 'port' not in df.columns:
        df['port'] = 0

    return df, report
