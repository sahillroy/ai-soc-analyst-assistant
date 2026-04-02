"""
Run this from your project root to verify Groq is working:
    python test_groq.py
"""
import os
from dotenv import load_dotenv
load_dotenv()

key = os.getenv("GROQ_API_KEY")

print(f"GROQ_API_KEY loaded: {'YES — ' + key[:8] + '...' if key else 'NO — KEY IS MISSING'}")

if not key:
    print("\nFIX: Add this to your .env file:")
    print("  GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx")
    exit(1)

# Try a real API call
try:
    from openai import OpenAI
    client = OpenAI(
        api_key=key,
        base_url="https://api.groq.com/openai/v1",
    )
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Reply with exactly: {\"status\": \"ok\"}"}],
        response_format={"type": "json_object"},
        max_tokens=20,
    )
    print(f"Groq API call SUCCESS: {response.choices[0].message.content}")
    print("\nGroq is working. Run Analysis again to regenerate summaries.")

except Exception as e:
    print(f"\nGroq API call FAILED: {type(e).__name__}: {e}")
    print("\nCommon causes:")
    print("  - Wrong key (must start with gsk_)")
    print("  - Key copied with extra spaces")
    print("  - Key from OpenAI instead of console.groq.com")
