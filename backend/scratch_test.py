import sys
import urllib.request
import json

sys.stdout.reconfigure(encoding='utf-8')

def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_json(url):
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode('utf-8'))

print("--- Testing Live Health ---")
h = get_json("http://127.0.0.1:8000/api/health")
print("Health:", h["status"])

print("\n--- Testing Turn 1: Affordability ---")
chat1 = post_json("http://127.0.0.1:8000/api/ai/chat", {"message": "Can I afford a ₹50,000 laptop?"})
print("Intent:", chat1.get("intent"))
print("Summary:", chat1.get("summary"))
print("Understanding:", chat1.get("understanding")[:80] + "...")
print("Forecast:", chat1.get("forecast")[:80] + "...")
print("Proposed Action:", chat1.get("action"))

print("\n--- Testing Turn 2: Multi-Turn What-If ---")
chat2 = post_json("http://127.0.0.1:8000/api/ai/chat", {
    "message": "What if I buy it next month?",
    "conversation": [
        {"role": "user", "content": "Can I afford a ₹50,000 laptop?"},
        {"role": "assistant", "content": chat1.get("summary") or "Analyzing laptop purchase"}
    ]
})
print("Intent:", chat2.get("intent"))
print("What-If Scenario:", chat2.get("what_if", {}).get("scenario"))
print("Current Balance:", chat2.get("what_if", {}).get("current_balance"))
print("Projected Balance:", chat2.get("what_if", {}).get("projected_balance"))
print("Impact:", chat2.get("what_if", {}).get("impact_summary"))
print("Agent Contributions:")
for ac in chat2.get("agent_contributions", []):
    print(f"  • {ac.get('agent')} (Stage {ac.get('stage')}): {ac.get('observation')[:70]}...")

print("\n--- Testing Action Execution ---")
if chat1.get("action"):
    action = chat1["action"]
    confirm_res = post_json("http://127.0.0.1:8000/api/action/confirm", {
        "action_type": action["type"],
        "confirmed": True,
        "amount": action.get("amount", 10000),
        "description": action["description"]
    })
    print("Action Result:", confirm_res["message"])
    print("Action Executed:", confirm_res["action_executed"])

print("\n--- Testing Static Asset Delivery ---")
with urllib.request.urlopen("http://127.0.0.1:8000/") as resp:
    html = resp.read().decode('utf-8')
    print("Index.html length:", len(html), "has Financial Buddy:", "Financial Buddy" in html)

with urllib.request.urlopen("http://127.0.0.1:8000/app.js") as resp:
    js = resp.read().decode('utf-8')
    print("app.js length:", len(js), "has askAIWithContext:", "askAIWithContext" in js)
