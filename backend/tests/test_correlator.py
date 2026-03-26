from backend.detection.correlator import correlate_alerts
import pandas as pd

def test_single_campaign_from_one_attacker():
    df = pd.DataFrame({
        'source_ip': ['192.168.1.250'] * 5,
        'timestamp': pd.date_range('2024-01-01 10:00', periods=5, freq='2min'),
        'alert_type': ['Brute Force Attempt'] * 5,
        'severity': ['High'] * 5
    })
    result = correlate_alerts(df, time_window_minutes=15, min_alerts=2)
    # All 5 alerts from the same IP in a 15-min window = 1 campaign
    unique_campaigns = result[result['campaign_id'] != 'standalone']['campaign_id'].unique()
    assert len(unique_campaigns) == 1

def test_two_separate_campaigns():
    times = (
        list(pd.date_range('2024-01-01 10:00', periods=3, freq='2min')) +
        list(pd.date_range('2024-01-01 14:00', periods=3, freq='2min'))  # 4hr gap
    )
    df = pd.DataFrame({
        'source_ip': ['192.168.1.100'] * 6,
        'timestamp': times,
        'alert_type': ['Brute Force Attempt'] * 6,
        'severity': ['High'] * 6
    })
    result = correlate_alerts(df, time_window_minutes=15, min_alerts=2)
    unique_campaigns = result[result['campaign_id'] != 'standalone']['campaign_id'].unique()
    assert len(unique_campaigns) == 2  # morning burst ≠ afternoon burst