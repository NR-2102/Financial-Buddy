import os
import json
import logging
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.models import (
    FinancialProfile,
    Transaction,
    Budget,
    Account,
    Bill,
    Subscription,
    Goal,
    AlertItem,
    ActionConfirmationRequest,
    ActionConfirmationResponse,
    UserAuthRequest,
    AIChatRequest,
    AIChatResponse,
    AgentContribution,
    WhatIfComparison,
    ProposedAction,
    ExecuteActionRequest
)
from app.foundry_client import FoundryClient, format_as_bullet_points

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("financial_buddy.api")

app = FastAPI(
    title="Money Arnold API",
    description="AI Financial Assistant backend connecting to Microsoft Azure AI Foundry",
    version="2.0.0"
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "financial_data.json"
foundry_client = FoundryClient()

# In-memory prototype session user
current_user = {
    "email": "demo@financialbuddy.ai",
    "name": "Demo User",
    "is_authenticated": True
}

def get_demo_seed_data() -> dict:
    return {
        "profile": {
            "current_balance": 120000.0,
            "monthly_income": 60000.0,
            "monthly_expenses": 28500.0,
            "upcoming_bills": 19999.0,
            "savings_goal": 200000.0,
            "current_savings": 80000.0,
            "planned_purchase": {
                "item": "Laptop",
                "amount": 50000.0
            },
            "currency": "₹",
            "user_name": "Demo User",
            "user_email": "demo@gmail.com"
        },
        "accounts": [
            {
                "id": "acc-1",
                "name": "HDFC Salary Account",
                "type": "Bank",
                "balance": 75000.0,
                "masked_number": "•••• 4892"
            },
            {
                "id": "acc-2",
                "name": "ICICI Emergency Reserve",
                "type": "Savings",
                "balance": 35000.0,
                "masked_number": "•••• 7710"
            },
            {
                "id": "acc-3",
                "name": "Physical Cash Wallet",
                "type": "Cash",
                "balance": 10000.0,
                "masked_number": "Cash in Hand"
            },
            {
                "id": "acc-4",
                "name": "SBI Cashback Credit Card",
                "type": "Credit Card",
                "balance": -4500.0,
                "masked_number": "•••• 3194"
            }
        ],
        "budgets": [
            {"id": "b-1", "category": "Food", "amount": 10000.0},
            {"id": "b-2", "category": "Shopping", "amount": 8000.0},
            {"id": "b-3", "category": "Transport", "amount": 5000.0},
            {"id": "b-4", "category": "Entertainment", "amount": 3000.0},
            {"id": "b-5", "category": "Bills", "amount": 25000.0}
        ],
        "transactions": [
            {
                "id": "tx-1",
                "merchant": "Swiggy Food Delivery",
                "amount": 2500.0,
                "category": "Food",
                "confidence": "high",
                "date": "2026-09-02",
                "type": "expense",
                "account": "HDFC Salary Account",
                "notes": "Team lunch order"
            },
            {
                "id": "tx-2",
                "merchant": "Uber Cabs",
                "amount": 1200.0,
                "category": "Transport",
                "confidence": "high",
                "date": "2026-09-05",
                "type": "expense",
                "account": "HDFC Salary Account",
                "notes": "Airport trip commute"
            },
            {
                "id": "tx-3",
                "merchant": "Amazon India",
                "amount": 4500.0,
                "category": "Shopping",
                "confidence": "medium",
                "date": "2026-09-10",
                "type": "expense",
                "account": "SBI Cashback Credit Card",
                "notes": "Home essentials and mouse"
            },
            {
                "id": "tx-4",
                "merchant": "Netflix Subscription",
                "amount": 649.0,
                "category": "Entertainment",
                "confidence": "high",
                "date": "2026-09-12",
                "type": "expense",
                "account": "HDFC Salary Account",
                "notes": "Monthly Premium plan"
            },
            {
                "id": "tx-5",
                "merchant": "State Electricity Board",
                "amount": 2500.0,
                "category": "Bills",
                "confidence": "high",
                "date": "2026-09-15",
                "type": "expense",
                "account": "HDFC Salary Account",
                "notes": "Monthly electricity utility"
            },
            {
                "id": "tx-6",
                "merchant": "College Books & Stationary",
                "amount": 1500.0,
                "category": "Shopping",
                "confidence": "medium",
                "date": "2026-09-18",
                "type": "expense",
                "account": "Physical Cash Wallet",
                "notes": "AI & Finance course reference books"
            },
            {
                "id": "tx-7",
                "merchant": "Tech Consulting Monthly Payout",
                "amount": 60000.0,
                "category": "Income",
                "confidence": "high",
                "date": "2026-09-01",
                "type": "income",
                "account": "HDFC Salary Account",
                "notes": "Consulting retainer salary"
            },
            {
                "id": "tx-8",
                "merchant": "Zomato Dine-in",
                "amount": 1850.0,
                "category": "Food",
                "confidence": "high",
                "date": "2026-09-19",
                "type": "expense",
                "account": "HDFC Salary Account",
                "notes": "Weekend dinner with friends"
            },
            {
                "id": "tx-9",
                "merchant": "Metro Smart Card Recharge",
                "amount": 1000.0,
                "category": "Transport",
                "confidence": "high",
                "date": "2026-09-08",
                "type": "expense",
                "account": "HDFC Salary Account",
                "notes": "Monthly commute pass"
            },
            {
                "id": "tx-10",
                "merchant": "Spotify India",
                "amount": 119.0,
                "category": "Entertainment",
                "confidence": "high",
                "date": "2026-09-14",
                "type": "expense",
                "account": "HDFC Salary Account",
                "notes": "Individual monthly music stream"
            }
        ],
        "bills": [
            {"id": "bill-1", "name": "Apartment Rent", "amount": 15000.0, "due_date": "2026-10-01", "recurring": True, "status": "unpaid"},
            {"id": "bill-2", "name": "Electricity Bill", "amount": 2500.0, "due_date": "2026-09-28", "recurring": True, "status": "unpaid"},
            {"id": "bill-3", "name": "Broadband Internet (Airtel Fiber)", "amount": 1500.0, "due_date": "2026-09-29", "recurring": True, "status": "unpaid"},
            {"id": "bill-4", "name": "Mobile Postpaid", "amount": 999.0, "due_date": "2026-10-05", "recurring": True, "status": "unpaid"}
        ],
        "subscriptions": [
            {"id": "sub-1", "name": "Netflix Premium", "amount": 649.0, "frequency": "monthly", "next_date": "2026-10-12", "status": "active"},
            {"id": "sub-2", "name": "Spotify Premium", "amount": 119.0, "frequency": "monthly", "next_date": "2026-10-14", "status": "active"},
            {"id": "sub-3", "name": "Amazon Prime Annual", "amount": 1499.0, "frequency": "yearly", "next_date": "2027-04-10", "status": "active"},
            {"id": "sub-4", "name": "Gym & Fitness Membership", "amount": 2000.0, "frequency": "monthly", "next_date": "2026-10-01", "status": "active"}
        ],
        "goals": [
            {"id": "goal-1", "name": "6-Month Emergency Fund", "target_amount": 200000.0, "current_amount": 80000.0, "target_date": "2027-03-31", "monthly_contribution": 15000.0},
            {"id": "goal-2", "name": "M4 Pro Laptop Purchase", "target_amount": 50000.0, "current_amount": 25000.0, "target_date": "2026-11-15", "monthly_contribution": 10000.0},
            {"id": "goal-3", "name": "Year-End Travel & Vacation", "target_amount": 40000.0, "current_amount": 15000.0, "target_date": "2026-12-25", "monthly_contribution": 5000.0}
        ],
        "alerts": [
            {"id": "al-1", "level": "warning", "title": "Shopping Budget at 75%", "message": "You have spent ₹6,000 of your ₹8,000 Shopping budget for this month.", "status": "new", "timestamp": "2026-09-20T10:30:00Z"},
            {"id": "al-2", "level": "info", "title": "Upcoming Bills Due Soon", "message": "₹19,999 in total upcoming bills due within the next 14 days.", "status": "new", "timestamp": "2026-09-21T08:15:00Z"},
            {"id": "al-3", "level": "attention", "title": "Planned Purchase Feasibility", "message": "Purchasing the ₹50,000 Laptop leaves comfortable liquidity, but requires reserving ₹19,999 for bills first.", "status": "new", "timestamp": "2026-09-21T09:00:00Z"}
        ],
        "pending_action": {
            "type": "reserve_bill_funds",
            "description": "Reserve ₹19,999 from main balance to safeguard upcoming bills.",
            "amount": 19999.0,
            "status": "pending_confirmation"
        },
        "action_history": [
            {
                "type": "reserve_bill_funds",
                "status": "executed_mock",
                "amount": 5000.0,
                "description": "Mock reservation of ₹5,000 for utility bills",
                "previous_balance": 125000.0,
                "new_balance": 120000.0,
                "timestamp": "2026-09-15T14:22:00Z"
            }
        ]
    }

def load_stored_data() -> dict:
    if not DATA_FILE.exists():
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        seed = get_demo_seed_data()
        save_stored_data(seed)
        return seed
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure basic structures exist
            for key in ["accounts", "budgets", "transactions", "bills", "subscriptions", "goals", "alerts", "action_history"]:
                if key not in data:
                    data[key] = []
            return data
    except Exception as e:
        logger.error(f"Error loading {DATA_FILE}: {e}")
        return get_demo_seed_data()

def save_stored_data(data: dict):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def evaluate_dynamic_alerts(data: dict) -> dict:
    """
    Evaluates alerts dynamically based on actual spending vs budgets, upcoming bills, and account balances.
    Preserves user resolved status for existing alerts.
    """
    budgets = data.get("budgets", [])
    transactions = data.get("transactions", [])
    bills = data.get("bills", [])
    accounts = data.get("accounts", [])
    profile = data.get("profile", {})
    existing_alerts = {a.get("id"): a for a in data.get("alerts", []) if a.get("id")}

    # Calculate actual spending by category from expense transactions
    spending_by_category = {}
    for tx in transactions:
        if tx.get("type") != "income":
            cat = tx.get("category", "Other")
            spending_by_category[cat] = spending_by_category.get(cat, 0.0) + float(tx.get("amount", 0))

    new_alerts = []
    now_str = datetime.now(timezone.utc).isoformat()

    # 1. Budget Utilization Alerts
    for b in budgets:
        cat = b.get("category", "")
        limit = float(b.get("amount", 0))
        if limit <= 0 or not cat:
            continue
        spent = spending_by_category.get(cat, 0.0)
        pct = round((spent / limit) * 100.0)
        remaining = max(0.0, limit - spent)
        alert_id = f"alert-budget-{cat.lower().replace(' ', '-')}"
        prev_alert = existing_alerts.get(alert_id, {})
        prev_status = prev_alert.get("status", "active")
        prev_pct = prev_alert.get("meta", {}).get("pct", 0)
        # Re-activate if spending increased past a new threshold
        if prev_status == "resolved" and pct > prev_pct:
            prev_status = "active"

        if pct >= 100:
            new_alerts.append({
                "id": alert_id,
                "level": "danger",
                "title": f"{cat} Budget Exceeded ({pct}%)",
                "message": f"You have spent ₹{spent:,.0f} of your ₹{limit:,.0f} {cat} budget. Discretionary limit has been exceeded by ₹{spent - limit:,.0f}.",
                "status": prev_status,
                "created_at": prev_alert.get("created_at") or now_str,
                "meta": {"pct": pct, "category": cat, "spent": spent, "limit": limit}
            })
        elif pct >= 85: # Triggers at 85%, 90%, 95%
            new_alerts.append({
                "id": alert_id,
                "level": "warning",
                "title": f"{cat} Budget at {pct}% Threshold",
                "message": f"You have spent ₹{spent:,.0f} of your ₹{limit:,.0f} {cat} budget ({pct}%). Only ₹{remaining:,.0f} remains for this cycle.",
                "status": prev_status,
                "created_at": prev_alert.get("created_at") or now_str,
                "meta": {"pct": pct, "category": cat, "spent": spent, "limit": limit}
            })

    # 2. Upcoming Obligations & Liquidity Shortfall Alerts
    unpaid_bills = [b for b in bills if b.get("status") != "paid"]
    upcoming_bills_amt = sum(float(b.get("amount", 0)) for b in unpaid_bills)
    liquid_bal = sum(float(a.get("balance", 0)) for a in accounts if a.get("type") != "Credit Card") if accounts else float(profile.get("current_balance", 0))

    if upcoming_bills_amt > 0 and upcoming_bills_amt > liquid_bal:
        b_id = "alert-liquidity-deficit"
        prev_alert = existing_alerts.get(b_id, {})
        new_alerts.append({
            "id": b_id,
            "level": "danger",
            "title": "Urgent Liquidity Shortfall",
            "message": f"Upcoming scheduled bills (₹{upcoming_bills_amt:,.0f}) exceed your liquid reserve (₹{liquid_bal:,.0f}) by ₹{upcoming_bills_amt - liquid_bal:,.0f}.",
            "status": prev_alert.get("status", "active"),
            "created_at": prev_alert.get("created_at") or now_str
        })
    elif upcoming_bills_amt > 0:
        b_id = "alert-upcoming-bills"
        prev_alert = existing_alerts.get(b_id, {})
        new_alerts.append({
            "id": b_id,
            "level": "info",
            "title": "Upcoming Bills Due Soon",
            "message": f"₹{upcoming_bills_amt:,.0f} in scheduled obligations due soon. Reserve funds to ensure smooth settlement.",
            "status": prev_alert.get("status", "active"),
            "created_at": prev_alert.get("created_at") or now_str
        })

    # 3. Preserve non-budget, non-bill custom alerts (like feasibility)
    for a_id, a_obj in existing_alerts.items():
        if not a_id.startswith("alert-budget-") and a_id not in ["alert-liquidity-deficit", "alert-upcoming-bills"]:
            new_alerts.append(a_obj)

    data["alerts"] = new_alerts
    return data

# -------------------------------------------------------------
# Core System Endpoints
# -------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Money Arnold API",
        "foundry_endpoint": foundry_client.endpoint,
        "mock_fallback_enabled": foundry_client.use_mock_fallback
    }

@app.get("/api/foundry/config")
def get_foundry_config():
    """Returns active Azure AI Foundry settings and discovered agents."""
    return {
        "config": foundry_client.get_config(),
        "discovered_agents": foundry_client.discover_agents()
    }

@app.post("/api/foundry/config")
def update_foundry_config(cfg: Dict[str, Any]):
    """Updates Azure AI Foundry settings dynamically at runtime."""
    updated = foundry_client.update_config(cfg)
    return {
        "status": "success",
        "message": "Azure AI Foundry configuration updated",
        "config": updated,
        "discovered_agents": foundry_client.discover_agents(force=True)
    }

@app.get("/api/agents/discover")
def discover_agents():
    """Diagnostic endpoint to inspect Azure AI Foundry agents."""
    agents = foundry_client.discover_agents(force=True)
    return {
        "discovered_agents": agents,
        "active_config": foundry_client.get_config()
    }

# -------------------------------------------------------------
# Authentication Endpoints (Prototype Layer)
# -------------------------------------------------------------

@app.post("/api/auth/login")
def auth_login(req: UserAuthRequest):
    global current_user
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    is_demo = req.email.lower() in ["demo@gmail.com", "demouser@gmail.com", "demo@financialbuddy.ai"]
    if is_demo:
        # Only seed if no real data has been saved yet (preserves user changes)
        existing = load_stored_data() if DATA_FILE.exists() else None
        has_data = existing and len(existing.get("accounts", [])) > 0
        if not has_data:
            seed_data = get_demo_seed_data()
            seed_data["profile"]["user_name"] = "Demo User"
            seed_data["profile"]["user_email"] = req.email.lower()
            seed_data = evaluate_dynamic_alerts(seed_data)
            save_stored_data(seed_data)

    current_user = {
        "email": req.email,
        "name": req.name or ("Demo User" if is_demo else req.email.split("@")[0].title()),
        "is_authenticated": True
    }
    return {
        "status": "success",
        "message": "Login successful",
        "user": current_user
    }

@app.post("/api/auth/signup")
def auth_signup(req: UserAuthRequest):
    global current_user
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    current_user = {
        "email": req.email,
        "name": req.name or req.email.split("@")[0].title(),
        "monthly_income": req.monthly_income or 0.0,
        "primary_goal": req.primary_goal or "Emergency Fund",
        "is_authenticated": True
    }

    # Clean slate for new accounts: initialize all default values to zero
    user_name = req.name or req.email.split("@")[0].title()
    data = {
        "profile": {
            "current_balance": 0.0,
            "monthly_income": req.monthly_income or 0.0,
            "monthly_expenses": 0.0,
            "upcoming_bills": 0.0,
            "savings_goal": 0.0,
            "current_savings": 0.0,
            "planned_purchase": {
                "item": "",
                "amount": 0.0
            },
            "currency": "₹",
            "user_name": user_name,
            "user_email": req.email
        },
        "accounts": [],
        "budgets": [],
        "transactions": [],
        "bills": [],
        "subscriptions": [],
        "goals": [],
        "alerts": [],
        "pending_action": None,
        "action_history": []
    }
    save_stored_data(data)

    return {
        "status": "success",
        "message": "Account created successfully with zero default balances",
        "user": current_user
    }

@app.get("/api/auth/me")
def auth_me():
    return {"user": current_user}

@app.post("/api/auth/logout")
def auth_logout():
    global current_user
    current_user = {"email": "", "name": "", "is_authenticated": False}
    return {"status": "success", "message": "Logged out successfully"}

# -------------------------------------------------------------
# Financial Data & Profile
# -------------------------------------------------------------

@app.get("/api/financial-data")
def get_financial_data():
    data = load_stored_data()
    data = evaluate_dynamic_alerts(data)
    save_stored_data(data)
    return data

@app.post("/api/financial-data/profile")
def update_profile(profile: FinancialProfile):
    data = load_stored_data()
    data["profile"] = profile.model_dump()
    data = evaluate_dynamic_alerts(data)
    save_stored_data(data)
    return {"status": "success", "profile": data["profile"]}

@app.post("/api/financial-data/sync")
def sync_financial_data(full_data: Dict[str, Any]):
    """Sync complete financial profile entered in Manual Setup page."""
    data = load_stored_data()
    for key in ["profile", "accounts", "budgets", "transactions", "bills", "subscriptions", "goals"]:
        if key in full_data:
            data[key] = full_data[key]
    data = evaluate_dynamic_alerts(data)
    save_stored_data(data)
    return {"status": "success", "message": "All financial data synchronized successfully", "data": data}

@app.post("/api/financial-data/reset")
def reset_to_demo_data():
    """Resets the data store to the realistic fintech demo state."""
    seed_data = get_demo_seed_data()
    seed_data = evaluate_dynamic_alerts(seed_data)
    save_stored_data(seed_data)
    return {"status": "success", "message": "Data store reset to default demo dataset", "data": seed_data}

# -------------------------------------------------------------
# Transactions CRUD
# -------------------------------------------------------------

@app.post("/api/financial-data/transactions")
def add_transaction(tx: Transaction):
    data = load_stored_data()
    tx_dict = tx.model_dump()
    if not tx_dict.get("id"):
        tx_dict["id"] = f"tx-{len(data.get('transactions', [])) + 1}"
    
    # Auto-adjust account balance if account matched
    tx_amt = float(tx_dict.get("amount", 0))
    is_income = tx_dict.get("type", "expense") == "income"
    account_name = tx_dict.get("account")
    for acc in data.get("accounts", []):
        if acc.get("name") == account_name:
            if is_income:
                acc["balance"] = float(acc.get("balance", 0)) + tx_amt
            else:
                acc["balance"] = float(acc.get("balance", 0)) - tx_amt
            break

    data["transactions"].insert(0, tx_dict)
    data = evaluate_dynamic_alerts(data)
    save_stored_data(data)
    return {"status": "success", "transaction": tx_dict, "transactions": data["transactions"], "alerts": data["alerts"]}

@app.put("/api/financial-data/transactions/{tx_id}")
def update_transaction(tx_id: str, tx: Transaction):
    data = load_stored_data()
    txs = data.get("transactions", [])
    found = False
    for i, t in enumerate(txs):
        if t.get("id") == tx_id:
            tx_dict = tx.model_dump()
            tx_dict["id"] = tx_id
            txs[i] = tx_dict
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Transaction not found")
    data = evaluate_dynamic_alerts(data)
    save_stored_data(data)
    return {"status": "success", "transactions": data["transactions"], "alerts": data["alerts"]}

@app.delete("/api/financial-data/transactions/{tx_id}")
def delete_transaction(tx_id: str):
    data = load_stored_data()
    initial_len = len(data.get("transactions", []))
    data["transactions"] = [t for t in data.get("transactions", []) if t.get("id") != tx_id]
    if len(data["transactions"]) == initial_len:
        raise HTTPException(status_code=404, detail="Transaction not found")
    data = evaluate_dynamic_alerts(data)
    save_stored_data(data)
    return {"status": "success", "transactions": data["transactions"], "alerts": data["alerts"]}

# -------------------------------------------------------------
# Budgets CRUD
# -------------------------------------------------------------

@app.post("/api/financial-data/budgets")
def add_budget(budget: Budget):
    data = load_stored_data()
    b_dict = budget.model_dump()
    if not b_dict.get("id"):
        b_dict["id"] = f"b-{len(data.get('budgets', [])) + 1}"
    # Replace if category exists or append
    existing = False
    for i, b in enumerate(data.get("budgets", [])):
        if b.get("category", "").lower() == b_dict.get("category", "").lower():
            data["budgets"][i] = b_dict
            existing = True
            break
    if not existing:
        data["budgets"].append(b_dict)
    data = evaluate_dynamic_alerts(data)
    save_stored_data(data)
    return {"status": "success", "budgets": data["budgets"], "alerts": data["alerts"]}

@app.put("/api/financial-data/budgets/{b_id}")
def update_budget(b_id: str, budget: Budget):
    data = load_stored_data()
    budgets = data.get("budgets", [])
    for i, b in enumerate(budgets):
        if b.get("id") == b_id or b.get("category", "").lower() == b_id.lower():
            b_dict = budget.model_dump()
            b_dict["id"] = b_id
            budgets[i] = b_dict
            data = evaluate_dynamic_alerts(data)
            save_stored_data(data)
            return {"status": "success", "budgets": data["budgets"], "alerts": data["alerts"]}
    raise HTTPException(status_code=404, detail="Budget category not found")

@app.delete("/api/financial-data/budgets/{b_id}")
def delete_budget(b_id: str):
    data = load_stored_data()
    initial_len = len(data.get("budgets", []))
    data["budgets"] = [b for b in data.get("budgets", []) if b.get("id") != b_id and b.get("category", "").lower() != b_id.lower()]
    if len(data["budgets"]) == initial_len:
        raise HTTPException(status_code=404, detail="Budget not found")
    data = evaluate_dynamic_alerts(data)
    save_stored_data(data)
    return {"status": "success", "budgets": data["budgets"], "alerts": data["alerts"]}

# -------------------------------------------------------------
# Bills CRUD
# -------------------------------------------------------------

@app.post("/api/financial-data/bills")
def add_bill(bill: Bill):
    data = load_stored_data()
    b_dict = bill.model_dump()
    if not b_dict.get("id"):
        b_dict["id"] = f"bill-{len(data.get('bills', [])) + 1}"
    data["bills"].append(b_dict)
    save_stored_data(data)
    return {"status": "success", "bills": data["bills"]}

@app.put("/api/financial-data/bills/{bill_id}")
def update_bill(bill_id: str, bill: Bill):
    data = load_stored_data()
    for i, b in enumerate(data.get("bills", [])):
        if b.get("id") == bill_id:
            b_dict = bill.model_dump()
            b_dict["id"] = bill_id
            data["bills"][i] = b_dict
            save_stored_data(data)
            return {"status": "success", "bills": data["bills"]}
    raise HTTPException(status_code=404, detail="Bill not found")

@app.delete("/api/financial-data/bills/{bill_id}")
def delete_bill(bill_id: str):
    data = load_stored_data()
    initial_len = len(data.get("bills", []))
    data["bills"] = [b for b in data.get("bills", []) if b.get("id") != bill_id]
    if len(data["bills"]) == initial_len:
        raise HTTPException(status_code=404, detail="Bill not found")
    save_stored_data(data)
    return {"status": "success", "bills": data["bills"]}

# -------------------------------------------------------------
# Subscriptions CRUD
# -------------------------------------------------------------

@app.post("/api/financial-data/subscriptions")
def add_subscription(sub: Subscription):
    data = load_stored_data()
    s_dict = sub.model_dump()
    if not s_dict.get("id"):
        s_dict["id"] = f"sub-{len(data.get('subscriptions', [])) + 1}"
    data["subscriptions"].append(s_dict)
    save_stored_data(data)
    return {"status": "success", "subscriptions": data["subscriptions"]}

@app.put("/api/financial-data/subscriptions/{sub_id}")
def update_subscription(sub_id: str, sub: Subscription):
    data = load_stored_data()
    for i, s in enumerate(data.get("subscriptions", [])):
        if s.get("id") == sub_id:
            s_dict = sub.model_dump()
            s_dict["id"] = sub_id
            data["subscriptions"][i] = s_dict
            save_stored_data(data)
            return {"status": "success", "subscriptions": data["subscriptions"]}
    raise HTTPException(status_code=404, detail="Subscription not found")

@app.delete("/api/financial-data/subscriptions/{sub_id}")
def delete_subscription(sub_id: str):
    data = load_stored_data()
    initial_len = len(data.get("subscriptions", []))
    data["subscriptions"] = [s for s in data.get("subscriptions", []) if s.get("id") != sub_id]
    if len(data["subscriptions"]) == initial_len:
        raise HTTPException(status_code=404, detail="Subscription not found")
    save_stored_data(data)
    return {"status": "success", "subscriptions": data["subscriptions"]}

# -------------------------------------------------------------
# Goals CRUD
# -------------------------------------------------------------

@app.post("/api/financial-data/goals")
def add_goal(goal: Goal):
    data = load_stored_data()
    g_dict = goal.model_dump()
    if not g_dict.get("id"):
        g_dict["id"] = f"goal-{len(data.get('goals', [])) + 1}"
    data["goals"].append(g_dict)
    save_stored_data(data)
    return {"status": "success", "goals": data["goals"]}

@app.put("/api/financial-data/goals/{goal_id}")
def update_goal(goal_id: str, goal: Goal):
    data = load_stored_data()
    for i, g in enumerate(data.get("goals", [])):
        if g.get("id") == goal_id:
            g_dict = goal.model_dump()
            g_dict["id"] = goal_id
            data["goals"][i] = g_dict
            save_stored_data(data)
            return {"status": "success", "goals": data["goals"]}
    raise HTTPException(status_code=404, detail="Goal not found")

@app.delete("/api/financial-data/goals/{goal_id}")
def delete_goal(goal_id: str):
    data = load_stored_data()
    initial_len = len(data.get("goals", []))
    data["goals"] = [g for g in data.get("goals", []) if g.get("id") != goal_id]
    if len(data["goals"]) == initial_len:
        raise HTTPException(status_code=404, detail="Goal not found")
    save_stored_data(data)
    return {"status": "success", "goals": data["goals"]}

# -------------------------------------------------------------
# Accounts CRUD
# -------------------------------------------------------------

@app.post("/api/financial-data/accounts")
def add_account(acc: Account):
    data = load_stored_data()
    a_dict = acc.model_dump()
    if not a_dict.get("id"):
        a_dict["id"] = f"acc-{len(data.get('accounts', [])) + 1}"
    data["accounts"].append(a_dict)
    save_stored_data(data)
    return {"status": "success", "accounts": data["accounts"]}

@app.put("/api/financial-data/accounts/{acc_id}")
def update_account(acc_id: str, acc: Account):
    data = load_stored_data()
    for i, a in enumerate(data.get("accounts", [])):
        if a.get("id") == acc_id:
            a_dict = acc.model_dump()
            a_dict["id"] = acc_id
            data["accounts"][i] = a_dict
            save_stored_data(data)
            return {"status": "success", "accounts": data["accounts"]}
    raise HTTPException(status_code=404, detail="Account not found")

@app.delete("/api/financial-data/accounts/{acc_id}")
def delete_account(acc_id: str):
    data = load_stored_data()
    initial_len = len(data.get("accounts", []))
    data["accounts"] = [a for a in data.get("accounts", []) if a.get("id") != acc_id]
    if len(data["accounts"]) == initial_len:
        raise HTTPException(status_code=404, detail="Account not found")
    save_stored_data(data)
    return {"status": "success", "accounts": data["accounts"]}

# -------------------------------------------------------------
# Yield / Investment Optimization (Preserved)
# -------------------------------------------------------------

@app.get("/api/investments/rates")
def get_investment_rates():
    """Returns top verified Indian Fixed Deposit and Government/PSU Bond rates."""
    data = load_stored_data()
    profile = data.get("profile", {})
    accounts = data.get("accounts", [])
    if accounts:
        curr_bal = sum(float(a.get("balance", 0)) for a in accounts)
    else:
        curr_bal = float(profile.get("current_balance", 120000))

    monthly_expenses = float(profile.get("monthly_expenses", 30000))
    upcoming_bills = float(profile.get("upcoming_bills", 5000))
    
    safe_reserve = (monthly_expenses * 2) + upcoming_bills
    idle_cash = max(0.0, curr_bal - safe_reserve)
    
    savings_return = round(idle_cash * 0.0275)
    senior_fd_return = round(idle_cash * 0.0850)
    extra_income = max(0, senior_fd_return - savings_return)

    return {
        "summary": {
            "current_balance": curr_bal,
            "recommended_liquid_buffer": safe_reserve,
            "idle_cash": idle_cash,
            "savings_account_return": savings_return,
            "senior_fd_return": senior_fd_return,
            "extra_annual_income": extra_income,
            "has_idle_cash": idle_cash >= 10000
        },
        "government_bonds": [
            {
                "name": "Senior Citizens Savings Scheme (SCSS)",
                "rate": "8.20%",
                "type": "Govt of India Sovereign",
                "payout": "Quarterly Payout",
                "safety": "100% Risk Free",
                "tax_benefit": "Sec 80C & Sec 80TTB eligible",
                "highlight": True
            },
            {
                "name": "RBI Floating Rate Savings Bonds (FRSB)",
                "rate": "8.05%",
                "type": "Reserve Bank of India",
                "payout": "Semi-Annual (Jan & July)",
                "safety": "100% Sovereign Guarantee",
                "tax_benefit": "No upper investment ceiling",
                "highlight": False
            },
            {
                "name": "Post Office Monthly Income Scheme (POMIS)",
                "rate": "7.40%",
                "type": "Govt of India",
                "payout": "Monthly Pension Payout",
                "safety": "100% Risk Free",
                "tax_benefit": "Ideal for regular monthly cash flow",
                "highlight": False
            }
        ],
        "bank_fds": [
            {
                "institution": "Unity Small Finance Bank",
                "senior_rate": "8.75%",
                "regular_rate": "8.25%",
                "tenure": "1001 Days",
                "safety": "RBI / DICGC Insured up to ₹5 Lakhs",
                "highlight": True
            },
            {
                "institution": "Suryoday / Equitas SFB",
                "senior_rate": "8.50%",
                "regular_rate": "8.00%",
                "tenure": "2 to 3 Years",
                "safety": "RBI / DICGC Insured up to ₹5 Lakhs",
                "highlight": True
            },
            {
                "institution": "State Bank of India (SBI Amrit Kalash)",
                "senior_rate": "7.60%",
                "regular_rate": "7.10%",
                "tenure": "400 Days",
                "safety": "India's Largest Public Bank",
                "highlight": False
            },
            {
                "institution": "HDFC / ICICI Bank",
                "senior_rate": "7.75%",
                "regular_rate": "7.25%",
                "tenure": "15 to 18 Months",
                "safety": "Top Tier Private Banks",
                "highlight": False
            }
        ]
    }

# -------------------------------------------------------------
# Azure AI Foundry 3-Agent Workflow Execution (Preserved)
# -------------------------------------------------------------

@app.post("/api/analyze")
def run_financial_analysis():
    """Runs the 3-agent Foundry workflow on current financial data."""
    data = load_stored_data()
    result = foundry_client.run_pipeline(data)
    
    # Store any pending mock action for confirmation
    alert_action = result.get("alert_action", {})
    if alert_action.get("requires_confirmation") and alert_action.get("action"):
        data["pending_action"] = alert_action["action"]
        save_stored_data(data)
        
    return result

@app.post("/api/action/confirm", response_model=ActionConfirmationResponse)
def confirm_mock_action(req: ActionConfirmationRequest):
    """
    Executes or cancels simulated mock financial action.
    No real money is ever transferred. Updates prototype state only.
    """
    data = load_stored_data()
    profile = data.get("profile", {})
    accounts = data.get("accounts", [])
    
    if accounts:
        curr_bal = sum(float(a.get("balance", 0)) for a in accounts)
    else:
        curr_bal = float(profile.get("current_balance", 0.0))
        
    curr_sav = float(profile.get("current_savings", 0.0))
    action_amount = req.amount or 5000.0

    if req.confirmed:
        new_bal = curr_bal - action_amount
        new_sav = curr_sav + action_amount
        profile["current_balance"] = new_bal
        profile["current_savings"] = new_sav

        # Also deduct from primary account if available
        if accounts:
            accounts[0]["balance"] = float(accounts[0].get("balance", 0)) - action_amount

        action_record = {
            "type": req.action_type,
            "status": "executed_mock",
            "amount": action_amount,
            "description": req.description or f"Mock reservation of ₹{action_amount:,.2f}",
            "previous_balance": curr_bal,
            "new_balance": new_bal
        }
        data["action_history"].append(action_record)
        data["pending_action"] = None
        save_stored_data(data)

        return ActionConfirmationResponse(
            status="completed",
            message=f"Mock action executed: Reserved ₹{action_amount:,.2f}. Main liquid balance is now ₹{new_bal:,.2f}.",
            action_executed=True,
            updated_balance=new_bal,
            updated_savings=new_sav
        )
    else:
        action_record = {
            "type": req.action_type,
            "status": "cancelled_by_user",
            "amount": action_amount,
            "description": req.description or "User dismissed the action."
        }
        data["action_history"].append(action_record)
        data["pending_action"] = None
        save_stored_data(data)

        return ActionConfirmationResponse(
            status="cancelled",
            message="Mock action was safely cancelled. No balances were modified.",
            action_executed=False,
            updated_balance=curr_bal,
            updated_savings=curr_sav
        )

# -------------------------------------------------------------
# AI Auto-Categorize & Execute Action Endpoints
# -------------------------------------------------------------

@app.post("/api/ai/categorize")
def ai_categorize_endpoint(body: Dict[str, Any]):
    """
    Auto-categorizes a transaction based on merchant name using Agent 1's
    keyword-matching logic. Returns {category, confidence}.
    """
    merchant = str(body.get("merchant", "")).lower()
    category = "Other"
    confidence = "medium"

    if any(k in merchant for k in ["swiggy", "zomato", "restaurant", "cafe", "food", "grocer", "mcdonald", "blinkit", "dunzo"]):
        category = "Food"
        confidence = "high"
    elif any(k in merchant for k in ["uber", "ola", "metro", "fuel", "petrol", "transport", "train", "bus", "rapido", "namma"]):
        category = "Transport"
        confidence = "high"
    elif any(k in merchant for k in ["amazon", "flipkart", "myntra", "shopping", "clothes", "book", "nykaa", "meesho"]):
        category = "Shopping"
        confidence = "medium"
    elif any(k in merchant for k in ["netflix", "spotify", "prime", "movie", "hotstar", "cinema", "youtube", "jio"]):
        category = "Entertainment"
        confidence = "high"
    elif any(k in merchant for k in ["electricity", "power", "water", "wifi", "bill", "recharge", "utility", "airtel", "bsnl", "broadband"]):
        category = "Bills"
        confidence = "high"
    elif any(k in merchant for k in ["hospital", "pharmacy", "doctor", "clinic", "medicine", "health", "apollo"]):
        category = "Healthcare"
        confidence = "high"
    elif any(k in merchant for k in ["school", "college", "course", "tuition", "education", "udemy", "coursera"]):
        category = "Education"
        confidence = "high"
    elif any(k in merchant for k in ["salary", "income", "consulting", "payout", "freelance", "retainer", "dividend"]):
        category = "Income"
        confidence = "high"

    return {"category": category, "confidence": confidence}


@app.post("/api/action/execute")
def execute_crud_action(req: ExecuteActionRequest):
    """
    Executes a real CRUD action (add_transaction, update_budget, add_budget)
    that the user has confirmed via the AI chat UI.
    """
    data = load_stored_data()
    payload = req.payload or {}

    if req.action_type == "add_transaction":
        tx_dict = {
            "id": f"tx-{len(data.get('transactions', [])) + 1}-ai",
            "merchant": payload.get("merchant", "AI Added"),
            "amount": float(payload.get("amount", 0)),
            "category": payload.get("category", "Other"),
            "confidence": "high",
            "date": payload.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "type": payload.get("type", "expense"),
            "account": payload.get("account") or (data.get("accounts", [{}])[0].get("name", "Primary Checking") if data.get("accounts") else "Primary Checking"),
            "notes": payload.get("notes") or "Added via AI Assistant"
        }
        # Adjust account balance
        tx_amt = float(tx_dict["amount"])
        is_income = tx_dict["type"] == "income"
        account_name = tx_dict["account"]
        for acc in data.get("accounts", []):
            if acc.get("name") == account_name:
                if is_income:
                    acc["balance"] = float(acc.get("balance", 0)) + tx_amt
                else:
                    acc["balance"] = float(acc.get("balance", 0)) - tx_amt
                break
        data["transactions"].insert(0, tx_dict)
        data = evaluate_dynamic_alerts(data)
        save_stored_data(data)
        return {
            "status": "success",
            "message": f"✅ Transaction added: {tx_dict['merchant']} — ₹{tx_amt:,.0f} ({tx_dict['category']}).",
            "transaction": tx_dict
        }

    elif req.action_type in ("update_budget", "add_budget"):
        category = payload.get("category", "")
        amount = float(payload.get("amount", 0))
        budgets = data.get("budgets", [])
        found = False
        for i, b in enumerate(budgets):
            if b.get("category", "").lower() == category.lower():
                budgets[i]["amount"] = amount
                found = True
                break
        if not found:
            budgets.append({"id": f"b-{len(budgets) + 1}-ai", "category": category, "amount": amount})
        data["budgets"] = budgets
        data = evaluate_dynamic_alerts(data)
        save_stored_data(data)
        action_word = "updated" if found else "created"
        return {
            "status": "success",
            "message": f"✅ {category} budget {action_word} to ₹{amount:,.0f}.",
            "budgets": data["budgets"]
        }

    elif req.action_type == "update_balance":
        # Add/subtract from the first (primary) account balance
        amount = float(payload.get("amount", 0))
        operation = payload.get("operation", "add")  # "add" or "set"
        accounts = data.get("accounts", [])
        if not accounts:
            raise HTTPException(status_code=400, detail="No accounts found to update.")
        old_bal = float(accounts[0].get("balance", 0))
        if operation == "set":
            new_bal = amount
        elif operation == "subtract":
            new_bal = old_bal - amount
        else:  # add
            new_bal = old_bal + amount
        accounts[0]["balance"] = new_bal
        data["accounts"] = accounts
        # Also update profile current_balance to sum of liquid accounts
        data["profile"]["current_balance"] = sum(float(a.get("balance", 0)) for a in accounts if a.get("type") != "Credit Card")
        data = evaluate_dynamic_alerts(data)
        save_stored_data(data)
        op_word = "set to" if operation == "set" else ("increased by" if operation == "add" else "decreased by")
        return {
            "status": "success",
            "message": f"✅ {accounts[0].get('name', 'Primary account')} balance {op_word} ₹{amount:,.0f}. New balance: ₹{new_bal:,.0f}.",
            "accounts": data["accounts"]
        }

    elif req.action_type == "update_savings":
        amount = float(payload.get("amount", 0))
        operation = payload.get("operation", "set")
        old_sav = float(data["profile"].get("current_savings", 0))
        if operation == "add":
            new_sav = old_sav + amount
        elif operation == "subtract":
            new_sav = max(0, old_sav - amount)
        else:
            new_sav = amount
        data["profile"]["current_savings"] = new_sav
        data = evaluate_dynamic_alerts(data)
        save_stored_data(data)
        return {
            "status": "success",
            "message": f"✅ Emergency savings updated to ₹{new_sav:,.0f}.",
            "profile": data["profile"]
        }

    elif req.action_type == "update_goal":
        field = payload.get("field", "savings_goal")  # savings_goal, monthly_income, monthly_expenses
        amount = float(payload.get("amount", 0))
        data["profile"][field] = amount
        if field == "savings_goal" and data.get("goals"):
            for g in data["goals"]:
                if "emergency" in g.get("name", "").lower():
                    g["target_amount"] = amount
                    break
        data = evaluate_dynamic_alerts(data)
        save_stored_data(data)
        label_map = {
            "savings_goal": "Savings Goal",
            "monthly_income": "Monthly Income",
            "monthly_expenses": "Monthly Expenses"
        }
        return {
            "status": "success",
            "message": f"✅ {label_map.get(field, field)} updated to ₹{amount:,.0f}.",
            "profile": data["profile"]
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action_type: {req.action_type}")


# -------------------------------------------------------------
# Conversational AI Assistant (Routes to 3-Agent Workflow)
# -------------------------------------------------------------
@app.post("/api/ai/chat", response_model=AIChatResponse)
def conversational_ai_chat(req: AIChatRequest):
    """
    Conversational assistant interface that runs the user's inquiry
    through the existing 3 Azure AI Foundry agents and returns structured UI cards:
    - Narrative response & high-level summary
    - Understanding (Agent 1 insights)
    - Why It Matters (Agent 1 & Agent 2 contextual impact)
    - Forecast (Agent 2 cash flow projections)
    - What-If Comparison (Current vs Projected for scenario inquiries)
    - Personalized Recommendations (Agent 2)
    - Active Proactive Alerts (Agent 3)
    - Proposed Action with human confirmation gate (Agent 3)
    - Agent Contributions breakdown (Agent 1 Analyzer -> Agent 2 Planner -> Agent 3 Action)
    """
    data = load_stored_data()
    msg = req.message.strip()
    msg_lower = msg.lower()
    conv = req.conversation or []

    # 1. Multi-Turn Context Extraction:
    # If the user asks a follow-up ("What if I buy it next month?", "Can I afford it?"),
    # look back in conversation history to resolve previously discussed item and amount.
    detected_item = req.target_item
    detected_amount = req.target_amount

    # Check current message for item
    common_items = [
        "laptop", "phone", "iphone", "macbook", "ipad", "bike", "car", "watch",
        "tv", "television", "trip", "vacation", "flight", "course", "sofa", "furniture"
    ]
    for kw in common_items:
        if kw in msg_lower:
            detected_item = kw.title()
            break

    # Check current message for amount: prioritize explicit currency, then action amounts, then general numbers
    curr_amt_match = re.search(r'(?:₹|rs\.?|inr)\s*(\d+(?:,\d+)*(?:\.\d+)?)', msg, re.IGNORECASE)
    if curr_amt_match:
        try:
            val = float(curr_amt_match.group(1).replace(",", ""))
            if val > 0:
                detected_amount = val
        except ValueError:
            pass

    if not detected_amount:
        act_amt_match = re.search(r'(?:add|plus|deposit|set|update|by|to|for|of|spent|paid|increase|decrease)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)', msg, re.IGNORECASE)
        if act_amt_match:
            try:
                val = float(act_amt_match.group(1).replace(",", ""))
                if val > 0:
                    detected_amount = val
            except ValueError:
                pass

    if not detected_amount:
        amt_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)', msg, re.IGNORECASE)
        if amt_match:
            try:
                val = float(amt_match.group(1).replace(",", ""))
                if val > 0:
                    detected_amount = val
            except ValueError:
                pass

    # If item or amount not found in current message, look back in conversation history
    if not detected_item or not detected_amount:
        for prev in reversed(conv):
            prev_content = (prev.get("content") or "").lower()
            if not detected_item:
                for kw in common_items:
                    if kw in prev_content:
                        detected_item = kw.title()
                        break
            if not detected_amount:
                prev_amt = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)', prev_content, re.IGNORECASE)
                if prev_amt:
                    try:
                        val = float(prev_amt.group(1).replace(",", ""))
                        if val > 0:
                            detected_amount = val
                    except ValueError:
                        pass
            if detected_item and detected_amount:
                break

    # 2. Determine Query Intent
    intent = req.intent
    if not intent:
        # Check for execute_action FIRST (before other intents, since these messages are very specific)
        execute_keywords = [
            "add a", "add an", "record a", "record an", "log a", "log an",
            "i spent", "i paid", "just paid", "just spent",
            "set my", "set the", "update my", "update the", "increase my", "decrease my",
            "create a budget", "set budget", "change budget", "update budget",
            "to my balance", "to balance", "from my balance", "from balance",
            "add to balance", "add to my balance", "add to account", "add 5000", "add ₹",
            "set balance", "update balance", "change balance",
            "set savings", "update savings",
            "set goal", "update goal",
            "set income", "update income",
            "set expenses", "update expenses"
        ]
        is_balance_action = (
            any(p in msg_lower for p in ["to my balance", "to balance", "from my balance", "from balance", "set balance", "update balance", "my balance", "add to balance", "add to my balance"]) or
            (("balance" in msg_lower or "account" in msg_lower) and any(w in msg_lower for w in ["add", "deposit", "set", "update", "change", "increase", "decrease", "subtract", "deduct", "remove", "put", "top up"]))
        )
        is_savings_action = (
            ("saving" in msg_lower) and
            any(w in msg_lower for w in ["set", "update", "change", "add", "increase", "decrease", "make", "put", "deposit"])
        )
        # IMPORTANT: A read-only question such as "What is my income?"
        # must NOT become an execute_action. Only explicit modification
        # language should trigger a write action.
        is_goal_action = (
            (
                "goal" in msg_lower
                and any(w in msg_lower for w in [
                    "set", "update", "change", "increase", "decrease",
                    "add", "make", "create"
                ])
            )
            or
            (
                "income" in msg_lower
                and any(w in msg_lower for w in [
                    "set", "update", "change", "increase", "decrease"
                ])
            )
            or
            (
                "expense" in msg_lower
                and any(w in msg_lower for w in [
                    "set", "update", "change", "increase", "decrease"
                ])
            )
        )

        is_write_syntax = bool(re.search(r'^(?:add|record|log|insert)\s+(?:₹|rs\.?|inr|\d)', msg_lower))

        # Fast-Path Safety Guard: common read-only questions must never be converted into financial write actions.
        read_only_patterns = [
            r"^what(?:'s| is)\s+my\s+(?:income|monthly income|salary|balance|savings|expenses?)\s*\??$",
            r"^tell me\s+(?:my\s+)?(?:income|monthly income|salary|balance|savings|expenses?)\s*\??$",
            r"^how much\s+(?:is|are)\s+my\s+(?:income|monthly income|salary|balance|savings|expenses?)\s*\??$",
            r"^how much\s+do\s+i\s+(?:earn|make|spend)\s*\??$",
            r"^(?:is|are)\s+my\s+(?:emergency fund|savings)\s+(?:enough|sufficient|good|ok)\s*\??$",
            r"^(?:am i|are we)\s+on track\b",
            r"^can i\s+(?:afford|spend|buy)\b"
        ]
        is_explicit_read_only = any(re.search(p, msg_lower) for p in read_only_patterns)

        if not is_explicit_read_only and (any(kw in msg_lower for kw in execute_keywords) or is_balance_action or is_savings_action or is_goal_action or is_write_syntax):
            intent = "execute_action"
        elif req.alert_context or any(w in msg_lower for w in ["alert", "warning", "why did i get", "explain this alert"]):
            intent = "alert_explanation"
        elif any(w in msg_lower for w in ["why am i spending more", "why did my spending increase", "spending increase", "more this month", "spending higher", "spending more"]):
            intent = "spending_comparison"
        elif any(w in msg_lower for w in ["afford", "can i buy", "should i buy", "buy a", "buy the", "purchase"]):
            intent = "affordability_analysis"
        elif any(w in msg_lower for w in ["what if", "what happens if", "next month", "save less", "less next month"]):
            intent = "what_if_analysis"
        elif any(w in msg_lower for w in ["biggest expense", "spend the most", "largest expense", "top expense", "where does my money go", "where am i spending", "biggest expenses"]):
            intent = "biggest_expenses"
        elif any(w in msg_lower for w in ["bill", "bills coming", "due", "owe", "recurring", "subscription", "bills are due", "due soon"]):
            intent = "bill_analysis"
        elif any(w in msg_lower for w in ["emergency fund", "savings goal", "on track", "how much more to save", "reach my", "is my emergency fund"]):
            intent = "goal_analysis"
        elif any(cat in msg_lower for cat in ["food", "shopping", "transport", "entertainment", "bills", "healthcare", "education"]) or any(w in msg_lower for w in ["spent on", "spending on", "how much did i spend", "spend on", "spend more on it", "more on it", "can i spend"]):
            intent = "category_spending"
        elif any(w in msg_lower for w in ["budget", "within budget", "overspending", "budget limit", "left in my"]):
            intent = "budget_analysis"
        elif any(w in msg_lower for w in ["situation", "overview", "how am i doing", "summary", "financial state"]):
            intent = "financial_overview"
        else:
            intent = "general"

    # Fast-Path for Direct Action Intents (add transaction, update balance, savings, goal, budget)
    # Responds immediately without running analytical pipeline.
    if intent == "execute_action":
        amount_guess = detected_amount or 0.0
        if not amount_guess or amount_guess == 0.0:
            found_num = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)', msg, re.IGNORECASE)
            if found_num:
                try:
                    amount_guess = float(found_num.group(1).replace(",", ""))
                except ValueError:
                    amount_guess = 5000.0
            else:
                amount_guess = 0.0

        # Never invent an amount for a financial write operation.
        # If the user explicitly asked to modify something but omitted
        # the amount, return a clarification response instead.
        if amount_guess <= 0:
            return AIChatResponse(
                message="Please provide the amount you want me to change.",
                intent=intent,
                summary="A financial update was requested, but no amount was provided.",
                understanding="I detected a request to modify your financial records, but I could not find a valid amount.",
                why_it_matters="I will not invent an amount for a financial transaction or account update.",
                forecast="No financial data was changed.",
                what_if=None,
                recommendations=[],
                recommendation="",
                alerts=[],
                action=None,
                requires_confirmation=False,
                agent_contributions=[
                    AgentContribution(
                        agent="Financial Analyzer (Agent 1)",
                        stage="1",
                        observation="Write intent detected, but no amount was supplied."
                    )
                ],
                summarizer={},
                raw_workflow_result={}
            )

        # Sub-action detection
        is_balance_action = (
            any(p in msg_lower for p in ["to my balance", "to balance", "from my balance", "from balance", "set balance", "update balance", "my balance to", "add to balance", "add to my balance", "in my balance", "into balance"]) or
            (("balance" in msg_lower or "account" in msg_lower) and any(w in msg_lower for w in ["add", "deposit", "set", "update", "change", "increase", "decrease", "subtract", "deduct", "remove", "put", "top up"]))
        )

        is_savings_action = (
            ("saving" in msg_lower or "emergency fund" in msg_lower) and
            any(w in msg_lower for w in ["set", "update", "change", "add", "increase", "decrease", "make", "put", "deposit"]) and
            not ("goal" in msg_lower)
        )

        # Only explicit write language can reach update_goal.
        is_goal_action = (
            (
                "goal" in msg_lower
                and any(w in msg_lower for w in [
                    "set", "update", "change", "increase", "decrease",
                    "add", "make", "create"
                ])
            )
            or
            (
                "income" in msg_lower
                and any(w in msg_lower for w in [
                    "set", "update", "change", "increase", "decrease"
                ])
            )
            or
            (
                "expense" in msg_lower
                and any(w in msg_lower for w in [
                    "set", "update", "change", "increase", "decrease"
                ])
            )
        )

        is_budget_action = (
            "budget" in msg_lower and
            any(w in msg_lower for w in ["set", "update", "change", "create", "increase", "decrease", "make", "limit"])
        )

        if is_balance_action:
            action_type_detected = "update_balance"
            operation = "subtract" if any(w in msg_lower for w in ["subtract", "deduct", "remove", "take", "minus"]) else \
                        "set" if any(w in msg_lower for w in ["set", "change to", "make my balance", "is now"]) and not any(w in msg_lower for w in ["add", "deposit", "increase"]) else "add"
            action_payload = {"amount": amount_guess, "operation": operation}
            if operation == "add":
                action_desc = f"Add ₹{amount_guess:,.0f} to primary account balance"
            elif operation == "subtract":
                action_desc = f"Deduct ₹{amount_guess:,.0f} from primary account balance"
            else:
                action_desc = f"Set primary account balance to ₹{amount_guess:,.0f}"

        elif is_savings_action:
            action_type_detected = "update_savings"
            operation = "add" if any(w in msg_lower for w in ["add", "increase", "deposit"]) else \
                        "subtract" if any(w in msg_lower for w in ["subtract", "deduct", "remove"]) else "set"
            action_payload = {"amount": amount_guess, "operation": operation}
            if operation == "add":
                action_desc = f"Add ₹{amount_guess:,.0f} to emergency savings"
            elif operation == "subtract":
                action_desc = f"Deduct ₹{amount_guess:,.0f} from emergency savings"
            else:
                action_desc = f"Set emergency savings to ₹{amount_guess:,.0f}"

        elif is_goal_action:
            action_type_detected = "update_goal"
            field = "monthly_income" if ("income" in msg_lower or "salary" in msg_lower) else \
                    "monthly_expenses" if "expense" in msg_lower else "savings_goal"
            label = "Monthly Income" if field == "monthly_income" else \
                    "Monthly Expenses" if field == "monthly_expenses" else "Savings Goal"
            action_payload = {"field": field, "amount": amount_guess}
            action_desc = f"Set {label} to ₹{amount_guess:,.0f}"

        elif is_budget_action:
            action_type_detected = "update_budget"
            category_guess = "Other"
            budget_cat_match = re.search(r'(?:my|the)\s+([A-Za-z]+)\s+budget', msg, re.IGNORECASE)
            if budget_cat_match:
                category_guess = budget_cat_match.group(1).strip().title()
            else:
                for cat in ["Food", "Transport", "Shopping", "Entertainment", "Bills", "Healthcare", "Education"]:
                    if cat.lower() in msg_lower:
                        category_guess = cat
                        break
            action_payload = {
                "category": category_guess,
                "amount": amount_guess
            }
            action_desc = f"Set {category_guess} budget to ₹{amount_guess:,.0f}"

        else:
            action_type_detected = "add_transaction"
            tx_type = "expense"
            merchant_guess = "Unknown"
            category_guess = "Other"

            # Detect income vs expense
            income_signals = ["salary", "income", "received", "earned", "got paid", "credited", "inflow", "retainer"]
            if any(s in msg_lower for s in income_signals):
                tx_type = "income"
                category_guess = "Income"

            # Extract merchant from common patterns: "add a ₹500 Swiggy expense" or "record Zomato ₹300"
            merchant_match = re.search(
                r'(?:add|record|log|spent at|paid to|from)\s+(?:a|an|₹\d+\s+)?([A-Za-z][A-Za-z0-9 \-&\']+?)(?:\s+(?:expense|income|transaction|for|of|₹|\d)|\s*$)',
                msg, re.IGNORECASE
            )
            if merchant_match:
                merchant_guess = merchant_match.group(1).strip().title()

            # Auto-categorize based on merchant
            if merchant_guess and merchant_guess != "Unknown":
                cat_result = ai_categorize_endpoint({"merchant": merchant_guess})
                category_guess = cat_result.get("category", "Other")
                if tx_type == "income":
                    category_guess = "Income"

            # Direct category detection from phrasing like 'for food', 'on shopping'
            for cat in ["Food", "Shopping", "Transport", "Entertainment", "Bills", "Healthcare", "Education", "Groceries"]:
                if f"for {cat.lower()}" in msg_lower or f"on {cat.lower()}" in msg_lower or f"in {cat.lower()}" in msg_lower or cat.lower() in msg_lower.split():
                    category_guess = "Food" if cat == "Groceries" else cat
                    if merchant_guess == "Unknown":
                        merchant_guess = f"{category_guess} Expense"
                    break

            # Determine account from context
            first_account = (data.get("accounts") or [{}])[0].get("name", "Primary Checking")

            action_payload = {
                "merchant": merchant_guess,
                "amount": amount_guess,
                "type": tx_type,
                "category": category_guess,
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "account": first_account,
                "notes": "Added via AI Assistant"
            }
            action_desc = f"Add {tx_type} transaction: {merchant_guess} — ₹{amount_guess:,.0f} ({category_guess})"

        summary = f"AI-parsed action: {action_desc}."
        understanding = (
            f"I detected that you want to **{action_desc}**. "
            f"Please confirm the details and click **Confirm & Apply** to update your financial records permanently."
        )
        why_it_matters = (
            f"Keeping your balances and parameters up to date ensures your analytics, "
            f"recommendations, and safety cushions reflect your exact current state."
        )
        forecast = (
            f"• After confirmation, this update will be permanently saved to your financial profile and persist across refreshes."
        )
        msg_text = (
            f"Ready to **{action_desc}**. Please review and confirm the action below:"
        )

        proposed_action_obj = ProposedAction(
            type=action_type_detected,
            description=action_desc,
            amount=amount_guess,
            why=f"User requested: \"{msg}\"",
            expected_impact=f"Financial record will be permanently updated and saved.",
            status="pending_confirmation",
            payload=action_payload
        )

        return AIChatResponse(
            message=msg_text,
            intent=intent,
            summary=summary,
            understanding=understanding,
            why_it_matters=why_it_matters,
            forecast=forecast,
            what_if=None,
            recommendations=[],
            recommendation="",
            alerts=[],
            action=proposed_action_obj,
            requires_confirmation=True,
            agent_contributions=[
                AgentContribution(
                    agent="Financial Analyzer (Agent 1)",
                    stage="1",
                    observation=f"Detected execute_action intent: {action_desc}"
                )
            ],
            summarizer={},
            raw_workflow_result={}
        )

    # 3. Prepare Context & Run 4-Agent Pipeline
    temp_data = json.loads(json.dumps(data))
    if detected_item or detected_amount:
        item_name = detected_item or "Planned Purchase"
        item_amt = detected_amount or 0.0
        temp_data["profile"]["planned_purchase"] = {
            "item": item_name,
            "amount": item_amt
        }

    workflow_res = foundry_client.run_pipeline(temp_data, user_query=msg, intent=intent, conversation=conv)
    analyzer = workflow_res.get("analyzer", {})
    planner = workflow_res.get("planner", {})
    alert_action = workflow_res.get("alert_action", {})
    summarizer = workflow_res.get("summarizer", {})

    # Compute baseline financial metrics from actual context without hardcoded defaults
    profile = temp_data.get("profile", {})
    accounts = temp_data.get("accounts", [])
    curr_bal = sum(float(a.get("balance", 0)) for a in accounts if a.get("type") != "Credit Card") if accounts else float(profile.get("current_balance", 0.0))
    monthly_income = float(profile.get("monthly_income", 0.0))
    monthly_expenses = float(profile.get("monthly_expenses", 0.0))
    if monthly_income <= 0:
        income_txs = [t for t in temp_data.get("transactions", []) if t.get("type") == "income"]
        if income_txs:
            monthly_income = sum(float(t.get("amount", 0)) for t in income_txs)
    if monthly_expenses <= 0:
        expense_txs = [t for t in temp_data.get("transactions", []) if t.get("type") != "income"]
        if expense_txs:
            monthly_expenses = sum(float(t.get("amount", 0)) for t in expense_txs)
    monthly_surplus = max(0.0, monthly_income - monthly_expenses)
    curr_savings = float(profile.get("current_savings", 0.0))
    savings_goal = float(profile.get("savings_goal", 0.0))
    bills_list = temp_data.get("bills", [])
    unpaid_bills = [b for b in bills_list if b.get("status") != "paid"]
    upcoming_bills = sum(float(b.get("amount", 0)) for b in unpaid_bills) if bills_list else float(profile.get("upcoming_bills", 0.0))

    cash_flow = planner.get("cash_flow", {})
    affordability = planner.get("affordability_analysis", {})
    purchase_cost = float(affordability.get("cost", detected_amount or 0.0))
    item_label = affordability.get("item", detected_item or "Item")

    # 4. What-If Comparison for scenario queries
    what_if = None
    if intent == "what_if_analysis":
        is_next_month = "next month" in msg_lower
        extra_spend = detected_amount or 10000.0
        if is_next_month:
            scenario_name = f"Purchase {item_label} (₹{purchase_cost:,.0f}) Next Month" if purchase_cost > 0 else f"Delay Purchase to Next Month"
            proj_bal = curr_bal + monthly_surplus - upcoming_bills - purchase_cost
            impact_text = (
                f"Waiting until next month allows you to accumulate another month of surplus (+₹{monthly_surplus:,.0f}), "
                f"settle upcoming bills (₹{upcoming_bills:,.0f}), and leaves your net cushion ₹{monthly_surplus:,.0f} higher "
                f"compared to buying immediately."
            )
        else:
            scenario_name = f"Additional Outflow of ₹{extra_spend:,.0f}"
            proj_bal = max(0.0, curr_bal - extra_spend)
            impact_text = (
                f"An extra expenditure of ₹{extra_spend:,.0f} reduces your monthly surplus from +₹{monthly_surplus:,.0f} "
                f"to +₹{max(0.0, monthly_surplus - extra_spend):,.0f}."
            )

        what_if = WhatIfComparison(
            scenario=scenario_name,
            current_balance=curr_bal,
            projected_balance=proj_bal,
            current_savings=curr_savings,
            projected_savings=curr_savings,
            impact_summary=impact_text
        )

    # 5. Agent 4 Synthesized Conversational Message (Natural Language First)
    msg_text = summarizer.get("message") or summarizer.get("executive_summary") or workflow_res.get("message") or "Analysis complete."
    exec_summary_text = summarizer.get("executive_summary") or msg_text
    health_status = summarizer.get("health_score", "Healthy & Stable")

    understanding = msg_text
    why_it_matters = summarizer.get("insight") or f"Active monthly surplus (+₹{monthly_surplus:,.0f}/mo) maintains financial stability."
    forecast = f"• Expected 30-day liquid position: ₹{curr_bal + monthly_surplus - upcoming_bills:,.0f}.\n• Net buffer after scheduled bills: ₹{curr_bal - upcoming_bills:,.0f}."

    agent_contributions = [
        AgentContribution(
            agent="Financial Analyzer (Agent 1)",
            stage="1",
            observation=f"Categorized {len(temp_data.get('transactions', []))} transactions; monitored {len(temp_data.get('budgets', []))} budgets; tracked {len(temp_data.get('subscriptions', []))} subscriptions."
        ),
        AgentContribution(
            agent="Financial Planner (Agent 2)",
            stage="2",
            observation=f"Modeled cash flow (surplus +₹{monthly_surplus:,.0f}/mo); evaluated affordability for {item_label} (₹{purchase_cost:,.0f}); goal gap ₹{max(0.0, savings_goal - curr_savings):,.0f}."
        ),
        AgentContribution(
            agent="Proactive Alerts & Action (Agent 3)",
            stage="3",
            observation=f"Evaluated proactive safeguards ({len(alert_action.get('alerts', []))} alerts monitored); human confirmation gating."
        ),
        AgentContribution(
            agent="Financial Summary Agent (Agent 4)",
            stage="4",
            observation=f"Synthesized outputs across Analyzer, Planner, and Alert agents into conversational response; rated status as '{health_status}'."
        )
    ]

    # 6. Action Proposal from Agent 3 (Confirmation gating ONLY when required)
    action_obj = None
    req_confirm = False
    raw_action = alert_action.get("action")
    if alert_action.get("requires_confirmation") and raw_action:
        req_confirm = True
        act_amt = float(raw_action.get("amount", 0.0))
        action_obj = ProposedAction(
            type=raw_action.get("type", "reserve_bill_funds"),
            description=raw_action.get("description", "Requested financial action"),
            amount=act_amt,
            why=raw_action.get("why") or "User requested financial operation requiring human confirmation.",
            expected_impact=raw_action.get("expected_impact") or "Updates financial records upon confirmation.",
            status="pending_confirmation",
            payload=raw_action.get("payload")
        )

    # 7. Recommendations: strictly from Planner, NO fake recommendations
    rec_list = planner.get("recommendations", [])

    return AIChatResponse(
        message=msg_text,
        intent=intent or summarizer.get("response_type", "general"),
        summary=exec_summary_text,
        understanding=understanding,
        why_it_matters=why_it_matters,
        forecast=forecast,
        what_if=what_if,
        recommendations=rec_list,
        recommendation=" ".join([f"• {r}" for r in rec_list]) if rec_list else "",
        alerts=alert_action.get("alerts", []),
        action=action_obj,
        requires_confirmation=req_confirm,
        agent_contributions=agent_contributions,
        summarizer=summarizer,
        raw_workflow_result=workflow_res,
        response_type=summarizer.get("response_type", "information"),
        insight=summarizer.get("insight"),
        warning=summarizer.get("warning"),
        follow_up=summarizer.get("follow_up"),
        data_status=summarizer.get("data_status", "available")
    )

# -------------------------------------------------------------
# Serve Frontend Static Files
# -------------------------------------------------------------
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
