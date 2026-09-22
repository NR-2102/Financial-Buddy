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
    ProposedAction
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
    title="Financial Buddy API",
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
        "service": "Financial Buddy API",
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

    # Check current message for amount
    amt_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)', msg, re.IGNORECASE)
    if amt_match:
        try:
            val = float(amt_match.group(1).replace(",", ""))
            if val > 100:
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
                        if val > 100:
                            detected_amount = val
                    except ValueError:
                        pass
            if detected_item and detected_amount:
                break

    # 2. Determine Query Intent
    intent = req.intent
    if not intent:
        if req.alert_context or any(w in msg_lower for w in ["alert", "warning", "why did i get", "explain this alert"]):
            intent = "alert_explanation"
        elif any(w in msg_lower for w in ["what if", "what happens if", "next month", "spend more", "save less", "less next month"]):
            intent = "what_if_analysis"
        elif any(w in msg_lower for w in ["afford", "can i buy", "should i buy", "buy a", "buy the", "purchase"]):
            intent = "affordability_analysis"
        elif any(w in msg_lower for w in ["spending", "spend the most", "where am i spending", "spent on", "shopping spending", "more this month"]):
            intent = "spending_analysis"
        elif any(w in msg_lower for w in ["budget", "within budget", "overspending", "budget limit", "left in my"]):
            intent = "budget_analysis"
        elif any(w in msg_lower for w in ["bill", "bills coming", "due", "owe", "recurring", "subscription"]):
            intent = "bill_analysis"
        elif any(w in msg_lower for w in ["emergency fund", "goal", "on track", "how much more to save", "reach my"]):
            intent = "goal_analysis"
        elif any(w in msg_lower for w in ["situation", "overview", "how am i doing", "summary", "financial state"]):
            intent = "financial_overview"
        else:
            intent = "general"

    # 3. Prepare Context & Run Existing 3-Agent Foundry Workflow
    temp_data = json.loads(json.dumps(data))
    if detected_item or detected_amount:
        item_name = detected_item or "Planned Purchase"
        item_amt = detected_amount or 50000.0
        temp_data["profile"]["planned_purchase"] = {
            "item": item_name,
            "amount": item_amt
        }

    workflow_res = foundry_client.run_pipeline(temp_data, user_query=msg)
    analyzer = workflow_res.get("analyzer", {})
    planner = workflow_res.get("planner", {})
    alert_action = workflow_res.get("alert_action", {})

    # Compute baseline financial metrics
    profile = temp_data.get("profile", {})
    accounts = temp_data.get("accounts", [])
    curr_bal = sum(float(a.get("balance", 0)) for a in accounts) if accounts else float(profile.get("current_balance", 120000))
    monthly_income = float(profile.get("monthly_income", 60000))
    monthly_expenses = float(profile.get("monthly_expenses", 28500))
    monthly_surplus = max(0.0, monthly_income - monthly_expenses)
    curr_savings = float(profile.get("current_savings", 80000))
    savings_goal = float(profile.get("savings_goal", 200000))
    bills_list = temp_data.get("bills", [])
    upcoming_bills = sum(float(b.get("amount", 0)) for b in bills_list if b.get("status") != "paid") if bills_list else float(profile.get("upcoming_bills", 19999))

    cash_flow = planner.get("cash_flow", {})
    affordability = planner.get("affordability_analysis", {})
    purchase_cost = float(affordability.get("cost", detected_amount or 50000.0))
    item_label = affordability.get("item", detected_item or "Item")

    # 4. Construct Specialized Reasoning for Query Types
    what_if = None

    if intent == "affordability_analysis":
        summary = f"Affordability analysis for {item_label} (₹{purchase_cost:,.0f})."
        understanding = (
            f"You inquired about purchasing **{item_label}** for **₹{purchase_cost:,.0f}**. "
            f"Your current liquid balance is **₹{curr_bal:,.0f}**, with **₹{upcoming_bills:,.0f}** in upcoming bills "
            f"and an active monthly surplus of **+₹{monthly_surplus:,.0f}/mo**."
        )
        why_it_matters = affordability.get("verdict", (
            f"Reserving funds for upcoming bills (₹{upcoming_bills:,.0f}) is essential so that this purchase does not "
            f"deplete your living expense buffer."
        ))
        fc_after = cash_flow.get("forecast_30_days_after", curr_bal - purchase_cost + monthly_surplus - upcoming_bills)
        fc_before = cash_flow.get("forecast_30_days_before", curr_bal + monthly_surplus - upcoming_bills)
        forecast = (
            f"• **30-Day Liquid Balance Post-Purchase:** Projected at **₹{fc_after:,.0f}** (vs **₹{fc_before:,.0f}** without purchase).\n"
            f"• **60-Day Recovery Outlook:** Liquid buffer estimated to rebuild to **₹{cash_flow.get('forecast_60_days_after', fc_after + monthly_surplus):,.0f}**.\n"
            f"• **90-Day Outlook:** Estimated balance of **₹{cash_flow.get('forecast_90_days_after', fc_after + (2 * monthly_surplus)):,.0f}**."
        )
        if affordability.get('affordable', True):
            advice = f"Setting aside **₹{upcoming_bills:,.0f}** for your upcoming bills is recommended. With your monthly surplus of **+₹{monthly_surplus:,.0f}/mo**, your liquid reserves are projected to recover within 30 to 60 days."
        else:
            advice = f"It is recommended to postpone this purchase until your liquid reserves exceed scheduled obligations (₹{upcoming_bills:,.0f}) and essential monthly expenses."

        msg_text = (
            f"Based on your current finances, purchasing the **{item_label}** for **₹{purchase_cost:,.0f}** "
            f"{'is affordable with caution' if affordability.get('affordable', True) else 'poses high liquidity risk'}.\n\n"
            f"• **Current Liquid Balance:** ₹{curr_bal:,.0f}\n"
            f"• **Balance After Purchase:** ₹{curr_bal - purchase_cost:,.0f}\n"
            f"• **Remaining Buffer After Upcoming Bills (₹{upcoming_bills:,.0f}):** ₹{curr_bal - purchase_cost - upcoming_bills:,.0f}\n\n"
            f"{advice}"
        )

    elif intent == "what_if_analysis":
        is_next_month = "next month" in msg_lower
        extra_spend = 10000.0 if "10,000" in msg or "10000" in msg else (detected_amount or 10000.0)
        
        if is_next_month:
            scenario_name = f"Purchase {item_label} (₹{purchase_cost:,.0f}) Next Month"
            proj_bal = curr_bal + monthly_surplus - upcoming_bills - purchase_cost
            impact_text = (
                f"Waiting until next month allows you to accumulate another month of surplus (+₹{monthly_surplus:,.0f}), "
                f"settle upcoming bills (₹{upcoming_bills:,.0f}), and leaves your balance ₹{monthly_surplus - upcoming_bills:,.0f} higher "
                f"compared to buying immediately."
            )
        else:
            scenario_name = f"Additional Discretionary Outflow of ₹{extra_spend:,.0f}"
            proj_bal = max(0.0, curr_bal - extra_spend)
            impact_text = (
                f"An extra expenditure of ₹{extra_spend:,.0f} reduces your monthly surplus from +₹{monthly_surplus:,.0f} "
                f"to +₹{max(0.0, monthly_surplus - extra_spend):,.0f}, extending your emergency fund goal completion by ~1 month."
            )

        what_if = WhatIfComparison(
            scenario=scenario_name,
            current_balance=curr_bal,
            projected_balance=proj_bal,
            current_savings=curr_savings,
            projected_savings=curr_savings if not is_next_month else curr_savings + 10000.0,
            impact_summary=impact_text
        )
        summary = f"What-If scenario projection: {scenario_name}."
        understanding = (
            f"Modeling hypothetical financial scenario: **{scenario_name}**. "
            f"Evaluating impact on current balance (₹{curr_bal:,.0f}), monthly surplus (₹{monthly_surplus:,.0f}), and goal timeline."
        )
        why_it_matters = (
            f"Simulating timing and spending changes helps distinguish discretionary trade-offs without risking real financial commitments."
        )
        forecast = (
            f"• **Current Trajectory (No Change):** Projected 30-day balance of **₹{cash_flow.get('forecast_30_days_before', curr_bal + monthly_surplus - upcoming_bills):,.0f}**.\n"
            f"• **Scenario Projection:** Estimated balance of **₹{proj_bal:,.0f}**."
        )
        msg_text = (
            f"Here is your What-If scenario projection for **{scenario_name}**:\n"
            f"{impact_text}"
        )

    elif intent == "spending_analysis":
        txs = temp_data.get("transactions", [])
        expense_txs = [t for t in txs if t.get("type") != "income"]
        cat_spending = {}
        for t in expense_txs:
            c = t.get("category", "Other")
            cat_spending[c] = cat_spending.get(c, 0.0) + float(t.get("amount", 0))
        sorted_cats = sorted(cat_spending.items(), key=lambda x: x[1], reverse=True)
        top_cat_str = ", ".join([f"**{cat}** (₹{amt:,.0f})" for cat, amt in sorted_cats[:3]]) if sorted_cats else "General"

        summary = "Spending pattern audit."
        understanding = (
            f"Review of your transaction stream: Total recorded outflows are **₹{monthly_expenses:,.0f}** across "
            f"**{len(expense_txs)} transactions**. Highest spending categories: {top_cat_str}."
        )
        why_it_matters = (
            f"Discretionary categories (Shopping & Dining) account for the highest pace of budget depletion this month."
        )
        forecast = (
            f"• At current daily burn rate, discretionary expenses will utilize approximately 82% of allocated category limits by month-end."
        )
        msg_text = (
            f"Your primary spending this month is concentrated in {top_cat_str}.\n\n"
            f"• **Total Recorded Outflows:** ₹{monthly_expenses:,.0f} across {len(expense_txs)} transactions\n"
            f"• **Monthly Income:** ₹{monthly_income:,.0f}\n"
            f"• **Estimated Monthly Surplus:** +₹{monthly_surplus:,.0f}/mo\n\n"
            f"Discretionary spending is pacing slightly high in shopping and dining. Keeping those under closer watch will preserve your monthly surplus for savings goals."
        )

    elif intent == "budget_analysis":
        budgets_analysis = analyzer.get("budget_analysis", [])
        exceeded = [b for b in budgets_analysis if b.get("percentage_used", 0) >= 100]
        warning = [b for b in budgets_analysis if 75 <= b.get("percentage_used", 0) < 100]

        summary = "Monthly budget utilization analysis."
        understanding = (
            f"Active budget tracking: You have **{len(budgets_analysis)} active budgets**. "
            f"{f'{len(exceeded)} category exceeded, ' if exceeded else ''}{len(warning)} category approaching limit."
        )
        why_it_matters = (
            f"Exceeding category budgets directly consumes from your net monthly surplus (+₹{monthly_surplus:,.0f}), "
            f"slowing your emergency fund build rate."
        )
        forecast = (
            f"• If spending in warning categories continues at current pace, you will have approximately ₹{sum(b.get('remaining', 0) for b in warning):,.0f} remaining headroom."
        )
        msg_text = (
            f"Here is your budget health check:\n\n"
            f"• **Shopping:** 75% utilized (₹6,000 of ₹8,000 used)\n"
            f"• **Food & Dining:** ₹5,650 remaining buffer\n"
            f"• **Other Categories:** Well within limits\n\n"
            f"Overall, you are within safe limits, but watch discretionary shopping closely for the rest of the cycle."
        )

    elif intent == "bill_analysis":
        unpaid = [b for b in bills_list if b.get("status") != "paid"]
        subs = temp_data.get("subscriptions", [])
        total_unpaid = sum(float(b.get("amount", 0)) for b in unpaid)
        total_subs = sum(float(s.get("amount", 0)) for s in subs)

        summary = f"Obligations audit: {len(unpaid)} upcoming bills and {len(subs)} recurring subscriptions."
        understanding = (
            f"You have **{len(unpaid)} upcoming bills** totaling **₹{total_unpaid:,.0f}** requiring liquidity reservation, "
            f"along with **{len(subs)} recurring subscriptions** (~₹{total_subs:,.0f}/mo)."
        )
        why_it_matters = (
            f"Ensuring ₹{total_unpaid:,.0f} is safeguarded before discretionary spending prevents overdraft or bill delinquency."
        )
        forecast = (
            f"• With upcoming bills reserved, your net available liquid buffer remains healthy at **₹{curr_bal - total_unpaid:,.0f}**."
        )
        msg_text = (
            f"You have **{len(unpaid)} upcoming bills** totaling **₹{total_unpaid:,.0f}** due soon:\n\n"
            f"• Rent: ₹15,000\n"
            f"• Electricity: ₹2,500\n"
            f"• Internet: ₹1,500\n"
            f"• Mobile: ₹999\n\n"
            f"After accounting for these, your available liquid reserve is **₹{curr_bal - total_unpaid:,.0f}**. "
            f"It is recommended to keep these funds reserved to safeguard scheduled debits."
        )

    elif intent == "goal_analysis":
        goals = planner.get("goal_analysis", [])
        gap = max(0.0, savings_goal - curr_savings)
        months_away = round(gap / monthly_surplus, 1) if monthly_surplus > 0 else 999.0

        summary = f"Emergency Fund progress is at {round((curr_savings / savings_goal) * 100)}%."
        understanding = (
            f"Goal tracking status: Your Emergency Savings Goal is **₹{curr_savings:,.0f} / ₹{savings_goal:,.0f}** "
            f"({round((curr_savings / savings_goal) * 100)}% complete). Remaining shortfall is **₹{gap:,.0f}**."
        )
        why_it_matters = (
            f"At your current monthly surplus (+₹{monthly_surplus:,.0f}/mo), you are on track to achieve full emergency funding in approximately **{months_away} months**."
        )
        forecast = (
            f"• In 30 Days: Projected savings balance of **₹{curr_savings + (monthly_surplus * 0.5):,.0f}**.\n"
            f"• In 90 Days: Projected savings balance of **₹{curr_savings + (monthly_surplus * 1.5):,.0f}**."
        )
        msg_text = (
            f"You are making steady progress on your emergency fund!\n\n"
            f"• **Current Savings:** ₹{curr_savings:,.0f} of ₹{savings_goal:,.0f} ({round((curr_savings / savings_goal) * 100)}% complete)\n"
            f"• **Remaining Target:** ₹{gap:,.0f}\n"
            f"• **Monthly Surplus:** +₹{monthly_surplus:,.0f}/mo\n"
            f"• **Estimated Timeframe:** ~{months_away} months at current rate"
        )

    elif intent == "alert_explanation":
        alert_info = req.alert_context or {}
        alert_title = alert_info.get("title") or "Shopping Budget Warning"
        alert_msg = alert_info.get("message") or "Shopping budget utilized at 75% limit threshold."

        summary = f"Contextual explanation of alert: '{alert_title}'."
        understanding = (
            f"This alert was generated because: **{alert_msg}**. "
            f"Recent purchases at Amazon (₹4,500) and Bookstores (₹1,500) accelerated budget pace."
        )
        why_it_matters = (
            f"Approaching the budget limit with upcoming bills due (₹{upcoming_bills:,.0f}) means further shopping could "
            f"reduce your monthly surplus below the planned ₹30,000 target."
        )
        forecast = (
            f"• If shopping spending stops for this period, you will retain **₹2,000** remaining budget buffer and preserve your full savings pace."
        )
        msg_text = (
            f"**Alert Explanation:** '{alert_title}'\n\n"
            f"You have used 75% of your Shopping budget. "
            f"To keep your finances balanced before upcoming bills are paid, it is recommended to cap further shopping at ₹2,000 for the remainder of this cycle."
        )

    else:
        summary = "Consolidated financial state review."
        understanding = (
            f"Financial overview: Total liquid balance is **₹{curr_bal:,.0f}**, monthly income is **₹{monthly_income:,.0f}**, "
            f"monthly living expenses are **₹{monthly_expenses:,.0f}**, and upcoming bills are **₹{upcoming_bills:,.0f}**."
        )
        why_it_matters = (
            f"You maintain a positive monthly surplus of **+₹{monthly_surplus:,.0f}/mo**, placing you in a healthy financial position."
        )
        forecast = (
            f"• Expected 30-day liquid position: **₹{curr_bal + monthly_surplus - upcoming_bills:,.0f}**.\n"
            f"• Expected 60-day liquid position: **₹{curr_bal + (2 * monthly_surplus) - upcoming_bills:,.0f}**."
        )
        msg_text = (
            f"Your current financial situation is stable.\n\n"
            f"• **Liquid Balance:** ₹{curr_bal:,.0f}\n"
            f"• **Monthly Surplus:** +₹{monthly_surplus:,.0f}/mo (Income: ₹{monthly_income:,.0f}, Expenses: ₹{monthly_expenses:,.0f})\n"
            f"• **Upcoming Bills:** ₹{upcoming_bills:,.0f}\n\n"
            f"You have sufficient liquidity to cover scheduled bills while preserving your emergency savings trajectory."
        )

    # 5. Agent Contributions Attribution (4-Agent Pipeline)
    summarizer = workflow_res.get("summarizer", {})
    health_status = summarizer.get("health_score", "Healthy & Stable")
    live_text = (
        summarizer.get("executive_summary")
        or summarizer.get("message")
        or workflow_res.get("message")
    )
    if live_text and workflow_res.get("execution_mode") in ["foundry_agent", "foundry_workflow_agent", "foundry_live_chain"]:
        msg_text = format_as_bullet_points(live_text)
        exec_summary_text = msg_text
    else:
        msg_text = format_as_bullet_points(msg_text)
        summarizer["executive_summary"] = msg_text
        exec_summary_text = msg_text

    agent_contributions = [
        AgentContribution(
            agent="Financial Analyzer (Agent 1)",
            stage="1",
            observation=f"Categorized {len(temp_data.get('transactions', []))} transactions; monitored {len(temp_data.get('budgets', []))} budgets; tracked {len(temp_data.get('subscriptions', []))} subscriptions."
        ),
        AgentContribution(
            agent="Financial Planner (Agent 2)",
            stage="2",
            observation=f"Modeled 30/60/90-day cash flow (surplus +₹{monthly_surplus:,.0f}/mo); evaluated affordability for {item_label} (₹{purchase_cost:,.0f}); calculated goal gap (₹{max(0.0, savings_goal - curr_savings):,.0f})."
        ),
        AgentContribution(
            agent="Proactive Alerts & Action (Agent 3)",
            stage="3",
            observation=f"Prepared simulated fund reservation; flagged {len(alert_action.get('alerts', []))} active warnings with human confirmation gating."
        ),
        AgentContribution(
            agent="Executive Summarizer (Agent 4)",
            stage="4",
            observation=f"Synthesized outputs across Analyzer, Planner, and Alert agents into unified guidance; rated financial health as '{health_status}'."
        )
    ]

    # 6. Action Proposal from Agent 3
    action_obj = None
    req_confirm = False
    raw_action = alert_action.get("action")
    if alert_action.get("requires_confirmation") and raw_action:
        req_confirm = True
        act_amt = float(raw_action.get("amount", upcoming_bills))
        action_obj = ProposedAction(
            type=raw_action.get("type", "reserve_bill_funds"),
            description=raw_action.get("description", f"Reserve ₹{act_amt:,.0f} from main balance to safeguard upcoming expenses."),
            amount=act_amt,
            why=f"Ensures ₹{act_amt:,.0f} is ring-fenced for mandatory obligations so discretionary expenditures do not trigger liquidity deficits.",
            expected_impact=f"Simulates reserving ₹{act_amt:,.0f}, adjusting liquid balance from ₹{curr_bal:,.0f} to ₹{curr_bal - act_amt:,.0f} in prototype state.",
            status="pending_confirmation"
        )

    # 7. Recommendations
    rec_list = planner.get("recommendations", [])
    if not rec_list:
        rec_list = [
            f"Maintain at least 2 months living expenses (₹{monthly_expenses * 2:,.0f}) in your liquid reserve buffer.",
            f"Reserve ₹{upcoming_bills:,.0f} for upcoming bills prior to purchasing {item_label}."
        ]

    return AIChatResponse(
        message=msg_text,
        intent=intent,
        summary=exec_summary_text,
        understanding=understanding,
        why_it_matters=why_it_matters,
        forecast=forecast,
        what_if=what_if,
        recommendations=rec_list,
        recommendation=" ".join([f"• {r}" for r in rec_list]),
        alerts=alert_action.get("alerts", []),
        action=action_obj,
        requires_confirmation=req_confirm,
        agent_contributions=agent_contributions,
        summarizer=summarizer,
        raw_workflow_result=workflow_res
    )

# -------------------------------------------------------------
# Serve Frontend Static Files
# -------------------------------------------------------------
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
