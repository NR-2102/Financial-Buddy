from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class PlannedPurchase(BaseModel):
    item: str = "Laptop"
    amount: float = 50000.0

class FinancialProfile(BaseModel):
    current_balance: float = 120000.0
    monthly_income: float = 60000.0
    monthly_expenses: float = 30000.0
    upcoming_bills: float = 5000.0
    savings_goal: float = 200000.0
    current_savings: float = 80000.0
    planned_purchase: Optional[PlannedPurchase] = None
    currency: Optional[str] = "₹"
    user_name: Optional[str] = "Demo User"
    user_email: Optional[str] = "demo@financialbuddy.ai"

class Budget(BaseModel):
    id: Optional[str] = None
    category: str
    amount: float

class Transaction(BaseModel):
    id: Optional[str] = None
    merchant: str
    amount: float
    category: Optional[str] = None
    confidence: Optional[str] = "high"
    date: Optional[str] = None
    type: Optional[str] = "expense"  # "expense" or "income"
    account: Optional[str] = "Primary Checking"
    notes: Optional[str] = None

class Account(BaseModel):
    id: Optional[str] = None
    name: str
    type: str = "Bank"  # "Bank", "Savings", "Cash", "Credit Card", "Investment", "Other"
    balance: float
    masked_number: Optional[str] = None

class Bill(BaseModel):
    id: Optional[str] = None
    name: str
    amount: float
    due_date: str
    recurring: bool = True
    status: str = "unpaid"  # "unpaid", "paid", "overdue"

class Subscription(BaseModel):
    id: Optional[str] = None
    name: str
    amount: float
    frequency: str = "monthly"  # "monthly", "yearly"
    next_date: Optional[str] = None
    status: str = "active"

class Goal(BaseModel):
    id: Optional[str] = None
    name: str
    target_amount: float
    current_amount: float = 0.0
    target_date: Optional[str] = None
    monthly_contribution: Optional[float] = 0.0

class AlertItem(BaseModel):
    id: Optional[str] = None
    level: str = "warning"  # "info", "warning", "danger", "attention"
    title: str
    message: str
    status: str = "new"  # "new", "seen", "resolved"
    timestamp: Optional[str] = None
    action: Optional[Dict[str, Any]] = None

class FinancialDataStore(BaseModel):
    profile: FinancialProfile
    budgets: List[Budget] = []
    transactions: List[Transaction] = []
    accounts: List[Account] = []
    bills: List[Bill] = []
    subscriptions: List[Subscription] = []
    goals: List[Goal] = []
    alerts: List[AlertItem] = []
    pending_action: Optional[Dict[str, Any]] = None
    action_history: List[Dict[str, Any]] = []

class ActionConfirmationRequest(BaseModel):
    action_type: str = Field(..., description="e.g. reserve_bill_funds, reserve_purchase_funds, transfer_to_savings")
    confirmed: bool = Field(..., description="True to execute mock action, False to cancel")
    amount: Optional[float] = None
    description: Optional[str] = None

class ActionConfirmationResponse(BaseModel):
    status: str
    message: str
    action_executed: bool
    updated_balance: float
    updated_savings: float

class UserAuthRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    monthly_income: Optional[float] = None
    primary_goal: Optional[str] = None

class AgentContribution(BaseModel):
    agent: str  # "Financial Analyzer (Agent 1)", "Financial Planner (Agent 2)", "Proactive Alerts & Action (Agent 3)"
    stage: str  # "1", "2", "3"
    observation: str

class WhatIfComparison(BaseModel):
    scenario: str
    current_balance: float
    projected_balance: float
    current_savings: float
    projected_savings: float
    impact_summary: str

class ProposedAction(BaseModel):
    type: str
    description: str
    amount: Optional[float] = None
    why: str
    expected_impact: str
    status: str = "pending_confirmation"
    payload: Optional[Dict[str, Any]] = None  # carries transaction/budget data for execute_action intents

class AIChatRequest(BaseModel):
    message: str
    conversation: Optional[List[Dict[str, Any]]] = []
    context: Optional[Dict[str, Any]] = None
    alert_context: Optional[Dict[str, Any]] = None
    target_item: Optional[str] = None
    target_amount: Optional[float] = None
    intent: Optional[str] = None

class AIChatResponse(BaseModel):
    message: str
    intent: str
    summary: str
    understanding: str
    why_it_matters: str
    forecast: str
    what_if: Optional[WhatIfComparison] = None
    recommendations: List[str] = []
    recommendation: Optional[str] = ""
    alerts: List[Dict[str, Any]] = []
    action: Optional[ProposedAction] = None
    requires_confirmation: bool = False
    agent_contributions: List[AgentContribution] = []
    summarizer: Optional[Dict[str, Any]] = None
    raw_workflow_result: Optional[Dict[str, Any]] = None
    response_type: Optional[str] = "information"
    insight: Optional[str] = None
    warning: Optional[str] = None
    follow_up: Optional[str] = None
    data_status: Optional[str] = "available"

class ExecuteActionRequest(BaseModel):
    action_type: str  # "add_transaction", "update_budget", "add_budget"
    payload: Dict[str, Any]  # the actual transaction/budget data to save

