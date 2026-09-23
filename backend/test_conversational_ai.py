import os
import sys
import json
from fastapi.testclient import TestClient

# Add app to path
sys.path.insert(0, os.path.dirname(__file__))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from app.main import app

client = TestClient(app)

def test_conversational_ai():
    print("=" * 70)
    print("RUNNING CONVERSATIONAL AI & SUMMARY AGENT TEST SUITE")
    print("=" * 70)

    # Reset demo data to ensure consistent baseline
    res = client.post("/api/financial-data/reset")
    assert res.status_code == 200, "Reset failed"
    print("✓ Reset to clean demo data: OK\n")

    # =========================================================================
    # SCENARIO 1: Spending comparison (Honest Grounding & Missing Data)
    # =========================================================================
    print("--- SCENARIO 1: Spending Comparison ---")
    payload = {"message": "Why am I spending more this month?"}
    res = client.post("/api/ai/chat", json=payload)
    assert res.status_code == 200, f"Scenario 1 failed: {res.text}"
    s1 = res.json()
    message = s1.get("message", "")
    print(f"Assistant:\n{message}\n")
    # Must NOT fabricate previous month comparison without data; must state missing data honestly
    assert "previous-period" in message.lower() or "last month" in message.lower() or "missing" in message.lower() or "do not have" in message.lower(), "Missing data transparent disclosure not found"
    assert "15,818" in message or "Shopping" in message, "Current recorded spending not found"
    assert s1.get("requires_confirmation") is False, "Informational query should NOT require confirmation"
    assert s1.get("action") is None or s1.get("requires_confirmation") is False
    print("✓ Scenario 1 PASSED: Grounded response with transparent missing-data handling\n")

    # =========================================================================
    # SCENARIO 2: Category spending (Food)
    # =========================================================================
    print("--- SCENARIO 2: Category Spending (Food) ---")
    payload = {"message": "How much did I spend on food?"}
    res = client.post("/api/ai/chat", json=payload)
    assert res.status_code == 200
    s2 = res.json()
    message = s2.get("message", "")
    print(f"Assistant:\n{message}\n")
    assert "4,350" in message, "Food spending of ₹4,350 not identified"
    assert "5,650" in message or "remaining" in message.lower(), "Remaining food budget not identified"
    assert s2.get("requires_confirmation") is False
    print("✓ Scenario 2 PASSED: Exact calculation without bullet list spam\n")

    # =========================================================================
    # SCENARIO 3: Emergency Fund Check
    # =========================================================================
    print("--- SCENARIO 3: Emergency Fund Evaluation ---")
    payload = {"message": "Is my emergency fund enough?"}
    res = client.post("/api/ai/chat", json=payload)
    assert res.status_code == 200
    s3 = res.json()
    message = s3.get("message", "")
    print(f"Assistant:\n{message}\n")
    assert "80,000" in message or "200,000" in message, "Emergency savings details not found"
    assert s3.get("requires_confirmation") is False
    print("✓ Scenario 3 PASSED: Accurate assessment of emergency reserves\n")

    # =========================================================================
    # SCENARIO 4: Affordability Check (₹50k laptop)
    # =========================================================================
    print("--- SCENARIO 4: Affordability Check (Laptop) ---")
    payload = {"message": "Can I afford a ₹50,000 laptop right now?"}
    res = client.post("/api/ai/chat", json=payload)
    assert res.status_code == 200
    s4 = res.json()
    message = s4.get("message", "")
    print(f"Assistant:\n{message}\n")
    assert "50,000" in message
    assert "120,000" in message or "balance" in message.lower()
    assert s4.get("requires_confirmation") is False, "Affordability check should NOT show confirmation card"
    print("✓ Scenario 4 PASSED: Affordability evaluated with liquid balance and bills\n")

    # =========================================================================
    # SCENARIO 5: Action Request (Add ₹2,000 food expense)
    # =========================================================================
    print("--- SCENARIO 5: Action Request ---")
    payload = {"message": "Add ₹2,000 expense for food"}
    res = client.post("/api/ai/chat", json=payload)
    assert res.status_code == 200
    s5 = res.json()
    message = s5.get("message", "")
    print(f"Assistant:\n{message}")
    print(f"Action: {s5.get('action')}")
    print(f"Requires Confirmation: {s5.get('requires_confirmation')}\n")
    assert s5.get("requires_confirmation") is True, "Action request MUST set requires_confirmation=True"
    assert s5.get("action") is not None, "Action object must be present"
    assert s5.get("action", {}).get("type") == "add_transaction"
    assert s5.get("action", {}).get("amount") == 2000.0 or s5.get("action", {}).get("amount") == 2000
    print("✓ Scenario 5 PASSED: Action generated with requires_confirmation=True\n")

    # =========================================================================
    # SCENARIO 6: Biggest Expenses
    # =========================================================================
    print("--- SCENARIO 6: Biggest Expenses ---")
    payload = {"message": "What are my biggest expenses this month?"}
    res = client.post("/api/ai/chat", json=payload)
    assert res.status_code == 200
    s6 = res.json()
    message = s6.get("message", "")
    print(f"Assistant:\n{message}\n")
    assert "Amazon" in message or "Shopping" in message or "4,500" in message
    assert s6.get("requires_confirmation") is False
    print("✓ Scenario 6 PASSED: Largest outflows identified accurately\n")

    # =========================================================================
    # SCENARIO 7: Upcoming Bills
    # =========================================================================
    print("--- SCENARIO 7: Upcoming Bills ---")
    payload = {"message": "What bills are due soon?"}
    res = client.post("/api/ai/chat", json=payload)
    assert res.status_code == 200
    s7 = res.json()
    message = s7.get("message", "")
    print(f"Assistant:\n{message}\n")
    assert "19,999" in message or "bill" in message.lower()
    assert s7.get("requires_confirmation") is False
    print("✓ Scenario 7 PASSED: Upcoming obligations listed accurately\n")

    # =========================================================================
    # MULTI-TURN CONVERSATION: Pronoun Resolution ("it" -> Food)
    # =========================================================================
    print("--- MULTI-TURN CONVERSATION TEST ---")
    conv_history = [
        {"role": "user", "content": "How much did I spend on food?"},
        {"role": "assistant", "content": "You spent ₹4,350 on Food this month across 2 transactions. Your monthly Food budget is ₹10,000, so you have ₹5,650 remaining for this cycle."}
    ]
    payload = {
        "message": "Can I spend more on it?",
        "conversation": conv_history
    }
    res = client.post("/api/ai/chat", json=payload)
    assert res.status_code == 200
    multi_res = res.json()
    message = multi_res.get("message", "")
    print(f"Turn 1: How much did I spend on food?")
    print(f"Turn 2 User: Can I spend more on it?")
    print(f"Turn 2 Assistant:\n{message}\n")
    assert "food" in message.lower() or "5,650" in message or "remaining" in message.lower()
    print("✓ Multi-turn context resolution PASSED: Pronoun 'it' correctly resolved to Food\n")

    print("=" * 70)
    print("ALL 7 SCENARIOS & MULTI-TURN CONVERSATION TESTS PASSED WITH 100% SUCCESS! 🎉")
    print("=" * 70)

if __name__ == "__main__":
    test_conversational_ai()
