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

def test_system():
    print("=" * 60)
    print("STARTING FINANCIAL BUDDY AUTOMATED SYSTEM VERIFICATION")
    print("=" * 60)

    # 1. Health Check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health = res.json()
    print("✓ Health Check: OK", health)

    # 2. Reset to Demo Data
    res = client.post("/api/financial-data/reset")
    assert res.status_code == 200, f"Reset failed: {res.text}"
    data = res.json().get("data", {})
    assert len(data.get("accounts", [])) >= 3, "Missing accounts in demo seed"
    assert len(data.get("budgets", [])) >= 4, "Missing budgets in demo seed"
    assert len(data.get("transactions", [])) >= 8, "Missing transactions in demo seed"
    print("✓ Reset to Demo Data: OK (Accounts, Budgets, Transactions, Bills seeded)")

    # 3. Get Financial Data
    res = client.get("/api/financial-data")
    assert res.status_code == 200
    store = res.json()
    print("✓ GET /api/financial-data: OK")

    # 4. Add Transaction
    new_tx = {
        "merchant": "Test Bookstore",
        "amount": 1200.0,
        "category": "Education",
        "type": "expense",
        "account": "HDFC Salary Account",
        "date": "2026-09-21",
        "notes": "FastAPI verification test"
    }
    res = client.post("/api/financial-data/transactions", json=new_tx)
    assert res.status_code == 200, f"Add transaction failed: {res.text}"
    tx_created = res.json().get("transaction", {})
    tx_id = tx_created.get("id")
    assert tx_id is not None
    print(f"✓ POST /api/financial-data/transactions: OK (ID: {tx_id})")

    # 5. Edit Transaction
    new_tx["amount"] = 1500.0
    res = client.put(f"/api/financial-data/transactions/{tx_id}", json=new_tx)
    assert res.status_code == 200, f"Update transaction failed: {res.text}"
    print("✓ PUT /api/financial-data/transactions/{id}: OK")

    # 6. Delete Transaction
    res = client.delete(f"/api/financial-data/transactions/{tx_id}")
    assert res.status_code == 200, f"Delete transaction failed: {res.text}"
    print("✓ DELETE /api/financial-data/transactions/{id}: OK")

    # 7. Add & Delete Budget
    new_budget = {"category": "Fitness", "amount": 4000.0}
    res = client.post("/api/financial-data/budgets", json=new_budget)
    assert res.status_code == 200
    res = client.delete("/api/financial-data/budgets/Fitness")
    assert res.status_code == 200
    print("✓ Budgets CRUD: OK")

    # 8. Add & Delete Bill
    new_bill = {"name": "Gym Pass", "amount": 2000.0, "due_date": "2026-10-10", "status": "unpaid", "recurring": True}
    res = client.post("/api/financial-data/bills", json=new_bill)
    assert res.status_code == 200
    bills = res.json().get("bills", [])
    gym_bill = [b for b in bills if b.get("name") == "Gym Pass"][0]
    res = client.delete(f"/api/financial-data/bills/{gym_bill['id']}")
    assert res.status_code == 200
    print("✓ Bills CRUD: OK")

    # 9. Add & Delete Goal
    new_goal = {"name": "New Bike", "target_amount": 80000.0, "current_amount": 10000.0, "target_date": "2027-01-01"}
    res = client.post("/api/financial-data/goals", json=new_goal)
    assert res.status_code == 200
    goals = res.json().get("goals", [])
    bike_goal = [g for g in goals if g.get("name") == "New Bike"][0]
    res = client.delete(f"/api/financial-data/goals/{bike_goal['id']}")
    assert res.status_code == 200
    print("✓ Goals CRUD: OK")

    # 10. Yield & Investment Optimizer Rates
    res = client.get("/api/investments/rates")
    assert res.status_code == 200
    rates = res.json()
    assert "government_bonds" in rates
    assert "bank_fds" in rates
    print("✓ GET /api/investments/rates: OK")

    # 11. Run Full 3-Agent AI Workflow
    print("Testing 3-Agent AI Foundry Workflow...")
    res = client.post("/api/analyze")
    assert res.status_code == 200, f"Analysis failed: {res.text}"
    wf_res = res.json()
    assert "analyzer" in wf_res, "Missing Agent 1 analyzer in response"
    assert "planner" in wf_res, "Missing Agent 2 planner in response"
    assert "alert_action" in wf_res, "Missing Agent 3 alert_action in response"
    print("✓ POST /api/analyze (3-Agent Pipeline): OK")
    print(f"  - Agent 1 Categorized Txs: {len(wf_res['analyzer'].get('categorized_transactions', []))}")
    print(f"  - Agent 2 Cash Flow Surplus: ₹{wf_res['planner'].get('cash_flow', {}).get('monthly_surplus')}")
    print(f"  - Agent 3 Proactive Alerts: {len(wf_res['alert_action'].get('alerts', []))}")

    # 12. Confirm Simulated Action
    confirm_payload = {
        "action_type": "reserve_bill_funds",
        "confirmed": True,
        "amount": 5000.0,
        "description": "Verification test fund reservation"
    }
    res = client.post("/api/action/confirm", json=confirm_payload)
    assert res.status_code == 200
    action_res = res.json()
    assert action_res["action_executed"] == True
    print("✓ POST /api/action/confirm: OK", action_res["message"])

    # 13. Conversational AI Chat Endpoint
    chat_payload = {
        "message": "Can I afford a ₹50,000 laptop right now?"
    }
    res = client.post("/api/ai/chat", json=chat_payload)
    assert res.status_code == 200, f"AI chat failed: {res.text}"
    chat_res = res.json()
    assert "understanding" in chat_res
    assert "why_it_matters" in chat_res
    assert "forecast" in chat_res
    assert "recommendation" in chat_res
    print("✓ POST /api/ai/chat (Conversational Interface): OK")
    print("  Understanding:", chat_res["understanding"][:80] + "...")
    print("  Forecast:", chat_res["forecast"][:80] + "...")

    # 14. Prototype Auth
    res = client.post("/api/auth/login", json={"email": "demo@financialbuddy.ai", "password": "password123"})
    assert res.status_code == 200
    print("✓ POST /api/auth/login: OK")

    print("=" * 60)
    print("ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀")
    print("=" * 60)

if __name__ == "__main__":
    test_system()
