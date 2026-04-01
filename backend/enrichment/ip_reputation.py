import ipaddress
import requests

PRIVATE_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
]

def is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return any(addr in net for net in PRIVATE_RANGES)
    except ValueError:
        return False

def check_ip_reputation(ip: str) -> dict:
    # Short-circuit for private/internal IPs — no network call needed
    if is_private_ip(ip):
        return {
            'country': 'Internal',
            'isp': 'Internal Network',
            'is_suspicious': False,
            'flags': ['private_ip']
        }

    # Public IP — query ip-api.com (free, no key required)
    try:
        response = requests.get(
            f"http://ip-api.com/json/{ip}?fields=status,country,isp,org,proxy,hosting",
            timeout=3
        )
        data = response.json()
        risk_flags = []
        if data.get('proxy'): risk_flags.append('proxy')
        if data.get('hosting'): risk_flags.append('hosting_provider')

        return {
            'country': data.get('country', 'Unknown'),
            'isp': data.get('isp', 'Unknown'),
            'is_suspicious': len(risk_flags) > 0,
            'flags': risk_flags
        }
    except Exception:
        return {'country': 'Unknown', 'is_suspicious': False, 'flags': []}

# For production: use AbuseIPDB API (free tier = 1000 checks/day)
def check_abuseipdb(ip: str, api_key: str) -> dict:
    headers = {'Key': api_key, 'Accept': 'application/json'}
    params = {'ipAddress': ip, 'maxAgeInDays': 90}
    r = requests.get('https://api.abuseipdb.com/api/v2/check',
                     headers=headers, params=params, timeout=5)
    data = r.json().get('data', {})
    return {
        'abuse_score': data.get('abuseConfidenceScore', 0),
        'total_reports': data.get('totalReports', 0),
        'is_known_abuser': data.get('abuseConfidenceScore', 0) > 50,
        'country': data.get('countryCode', '')
    }