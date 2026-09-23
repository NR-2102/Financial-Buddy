# Financial Buddy 💰

> An AI Financial Assistant prototype built with **Microsoft Azure AI Foundry** and **FastAPI**.

Designed as a college-project prototype to demonstrate multi-agent financial reasoning, cash-flow forecasting, budget alerts, and confirmation-driven mock actions without modifying real bank accounts.

---

## 🏗️ Architecture

```
Browser (Frontend UI)
       │
       ▼
FastAPI Backend (/api/analyze)
       │
       ▼
Microsoft Azure AI Foundry (MoneyArnold-01)
       │
       ├── Agent 1: Financial Analyzer (Categorization, Budgets, Subscriptions)
       │     ▼
       ├── Agent 2: Financial Planner (Cash Flow Forecast, Affordability, Goal Gap)
       │     ▼
       └── Agent 3: Alert & Action (Proactive Alerts, Simulation Action with Confirmation)
       │
       ▼
Unified JSON Response ──► Interactive Dashboard
```

---

## 📁 Project Structure

```
MoneyArnold/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI REST API & static file serving
│   │   ├── foundry_client.py   # Azure AI Foundry SDK integration & fallback
│   │   └── models.py           # Pydantic data schemas
│   ├── data/
│   │   └── financial_data.json # File-based financial store (No database needed)
│   ├── .env                    # Environment variables (Azure endpoint & IDs)
│   ├── .env.example            # Environment template
│   ├── requirements.txt        # Python dependencies
│   └── test_foundry.py         # Standalone diagnostic test script
│
├── frontend/
│   ├── index.html              # Interactive Dashboard UI
│   ├── style.css               # Clean responsive styling
│   └── app.js                  # Frontend controller & API bridge
│
├── run.sh                  # 1-Command startup script for macOS & Linux
├── run.bat                 # 1-Click startup script for Windows (Command Prompt)
├── run.ps1                 # PowerShell startup script for Windows
├── requirements.txt        # Top-level Python dependencies
├── .gitignore
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python 3.10+** (Python 3.11 or 3.12 recommended)
  - **macOS:** Install via Homebrew: `brew install python@3.11` (or download from [python.org](https://www.python.org/downloads/))
  - **Windows:** Download from [python.org](https://www.python.org/downloads/) (check "Add Python to PATH")
- An active Azure AI Foundry Project (`MoneyArnold-01`) or API Key (configured in `backend/.env`)

---

### 2. Fastest 1-Command Start

#### 🍎 On macOS / Linux
Open Terminal in the project root and run:
```bash
./run.sh
```
> **Tip:** If needed, ensure the script is executable first: `chmod +x run.sh`.
> The script automatically:
> - Detects `python3`
> - Activates or creates `.venv`
> - Installs all requirements if not yet installed
> - Copies `backend/.env.example` to `backend/.env` if missing
> - Launches the FastAPI server with live reload on port 8000!

*(Optional: Run on another port if port 8000 is occupied: `PORT=8080 ./run.sh`)*

#### 🪟 On Windows
Double-click:
```text
run.bat
```
or in PowerShell:
```powershell
.\run.ps1
```

---

### 3. Manual Terminal Startup

#### 🍎 On macOS / Linux:
```bash
# 1. Create and activate a virtual environment (first time only)
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies (first time only)
pip install -r requirements.txt

# 3. Configure environment (if not already done)
if [ ! -f backend/.env ]; then cp backend/.env.example backend/.env; fi

# 4. Navigate to backend and launch FastAPI
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

#### 🪟 On Windows:
```powershell
# 1. Create and activate a virtual environment (first time only)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Navigate to backend and launch FastAPI
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

---

### 4. Open in Your Browser

Navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

* **Demo Login:** Click **"⚡ Instant 1-Click Demo Login"** (or use `demo@gmail.com` / `demo1234`).
* **AI Assistant:** Navigate to the **AI Assistant** tab in the sidebar and ask any question to get live bulleted insights directly from your Azure AI Foundry Agent 4!

---

### 5. Verify the Azure AI Foundry Connection
Run the diagnostic script to test your Azure AI Foundry credentials and list discovered agents:
```bash
cd backend
python test_foundry.py
```

---

## ☁️ Deploying to Azure App Service

For a clean college demo, you can deploy the complete app (FastAPI + Frontend) directly to **Azure App Service (Linux)**:

```bash
# 1. Log in and set your subscription
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID_OR_NAME>"

# 2. Deploy from the backend folder
cd backend
az webapp up --runtime "PYTHON:3.11" --sku B1 --name financial-buddy-prototype

# 3. Configure the Foundry endpoint on App Service
az webapp config appsettings set \
  --name financial-buddy-prototype \
  --settings AZURE_AI_PROJECT_ENDPOINT="https://MoneyArnold-01.services.ai.azure.com/api/projects/MoneyArnold-01"

# 4. Enable Managed Identity for passwordless Azure auth
az webapp identity assign --name financial-buddy-prototype
```

Then in the Azure Portal:
1. Go to your **Azure AI Services / Foundry** resource (`MoneyArnold-01`).
2. Open **Access Control (IAM)** -> **Add role assignment**.
3. Select role **Azure AI Developer** (or **Cognitive Services OpenAI User**).
4. Assign access to **Managed Identity** -> Select your `financial-buddy-prototype` App Service.
5. Save. Your deployed web app now securely authenticates to Azure Foundry without storing secrets!

---

## 🛡️ Prototype Safety Note
This application executes **only simulated actions**. When a user confirms a fund reservation or payment action in the UI, it updates the session state and audit log within `financial_data.json`. No real bank accounts, cards, or payment gateways are accessed.
