import os
import sys
import uuid
import random
import string
import requests
import datetime
from datetime import timedelta

# --- CONFIGURATION ---
SUPABASE_URL = "https://ejqzexdkoqbvgmjtbbwd.supabase.co"
# You must set this in your environment or paste it here temporarily
SUPABASE_SERVICE_KEY = os.environ.get("PROJECTOR_SUPABASE_SERVICE_KEY")

# Resend API Key (for emailing the license)
RESEND_API_KEY = os.environ.get("RESEND_API_KEY") 
FROM_EMAIL = "licenses@creenly.com" # Update this to your verified sender

def generate_license_key():
    """Generates a readable license key like PRO-ABCD-EFGH-IJKL"""
    # 3 groups of 4 chars
    parts = []
    chars = string.ascii_uppercase + string.digits
    for _ in range(3):
        parts.append(''.join(random.choices(chars, k=4)))
    return f"PRO-{'-'.join(parts)}"

def create_license(email, days_valid=365):
    if not SUPABASE_SERVICE_KEY:
        print("ERROR: PROJECTOR_SUPABASE_SERVICE_KEY environment variable is not set.")
        print("Please grab the 'service_role' secret from Supabase Dashboard > Settings > API.")
        return

    key = generate_license_key()
    expires_at = (datetime.datetime.utcnow() + timedelta(days=days_valid)).isoformat()

    payload = {
        "license_key": key,
        "email": email,
        "status": "active",
        "current_period_end": expires_at
    }

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    print(f"Creating license for {email}...")
    response = requests.post(f"{SUPABASE_URL}/rest/v1/licenses", json=payload, headers=headers)

    if response.status_code in [200, 201]:
        print(f"SUCCESS: License Created!")
        print(f"Key: {key}")
        print(f"Expires: {expires_at}")
        
        # Send Email
        send_email(email, key)
    else:
        print(f"FAILED to create license: {response.text}")

def send_email(to_email, license_key):
    if not RESEND_API_KEY:
        print("WARNING: RESEND_API_KEY not found. Skipping email.")
        print(f"Please manually send key {license_key} to {to_email}")
        return

    print("Sending email via Resend...")
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    
    html_content = f"""
    <h1>Welcome to Creenly!</h1>
    <p>Thank you for your purchase.</p>
    <p><strong>Your License Key:</strong></p>
    <h2 style="font-family: monospace; background: #eee; padding: 10px;">{license_key}</h2>
    <p>Activate this key in the Settings panel of the Church Projector app.</p>
    """

    data = {
        "from": FROM_EMAIL,
        "to": to_email,
        "subject": "Your Creenly License Key",
        "html": html_content
    }

    try:
        resp = requests.post(url, json=data, headers=headers)
        if resp.status_code == 200:
            print("Email sent successfully!")
        else:
            print(f"Email failed: {resp.text}")
    except Exception as e:
        print(f"Email error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_license.py <customer_email> [days_valid]")
        sys.exit(1)
    
    email = sys.argv[1]
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 365
    
    create_license(email, days)
