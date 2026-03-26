# engine/correlator.py
import pandas as pd
from datetime import timedelta

def correlate_alerts(df, time_window_minutes=15, min_alerts=2):
    df = df.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    df['campaign_id'] = 'standalone'

    campaign_counter = 1

    for ip, group in df.groupby('source_ip'):
        if len(group) < min_alerts:
            continue

        group = group.sort_values('timestamp')
        assigned = {}  # row_index → campaign_id

        for idx in group.index:
            if idx in assigned:
                continue  # already part of a campaign — don't restart window

            t_start = group.loc[idx, 'timestamp']
            t_end = t_start + timedelta(minutes=time_window_minutes)

            window = group[
                (group['timestamp'] >= t_start) &
                (group['timestamp'] <= t_end)
            ]

            if len(window) >= min_alerts:
                cid = f"CAM-{campaign_counter:04d}"
                campaign_counter += 1
                for widx in window.index:
                    assigned[widx] = cid  # assign once, never overwrite

        for idx, cid in assigned.items():
            df.loc[idx, 'campaign_id'] = cid

    return df