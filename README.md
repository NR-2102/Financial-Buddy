# Financial Buddy (MoneyArnold)

An AI financial assistant prototype built with **Microsoft Azure AI Foundry** and **FastAPI**.

Financial Buddy takes a user's income and spending data and uses a small group of AI agents to categorise expenses, check budgets, forecast cash flow and raise alerts. It was built as a college project to explore multi-agent financial reasoning. Every action it takes is simulated, so no real bank account is ever touched.

---

## Features

- **Expense analysis:** categorises transactions, tracks budgets and spots recurring subscriptions.
- **Cash-flow forecast:** projects upcoming balance and checks whether a purchase is affordable.
- **Goal planning:** shows the gap between current savings and a savings goal.
- **Proactive alerts:** warns the user about overspending and low balance before it happens.
- **Confirmation-driven actions:** actions such as reserving funds only run after the user confirms, and they run in simulation only.
- **AI Assistant tab:** the user can ask a free-form question and get a short, bulleted answer from an Azure AI Foundry agent.
- **Interactive dashboard:** a single web page that shows the combined result of all agents.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn, Pydantic |
| AI | Microsoft Azure AI Foundry (multi-agent), `azure-ai-projects`, `azure-identity` |
| Frontend | HTML, CSS, JavaScript |
| Storage | JSON file (`backend/data/financial_data.json`), no database needed |
| Deployment | Azure App Service (Linux) |

---

## Architecture

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

**How a request flows**

1. The dashboard sends the user's financial data to `/api/analyze`.
2. The backend passes it to the Azure AI Foundry project, where the three agents run one after another.
3. The backend merges their outputs into one JSON response.
4. The dashboard renders the response as charts, alerts and suggested actions.

---

## Project Structure

```
Financial-Buddy/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI REST API & static file serving
│   │   ├── foundry_client.py   # Azure AI Foundry SDK integration & fallback
│   │   └── models.py           # Pydantic data schemas
│   ├── data/
│   │   └── financial_data.json # File-based financial store
│   ├── .env.example            # Environment template (copy to .env)
│   ├── requirements.txt        # Python dependencies
│   └── test_foundry.py         # Standalone diagnostic test script
│
├── frontend/
│   ├── index.html              # Interactive dashboard UI
│   ├── style.css               # Responsive styling
│   └── app.js                  # Frontend controller & API bridge
│
├── run.sh                      # One-command start for macOS & Linux
├── run.bat                     # One-click start for Windows (Command Prompt)
├── run.ps1                     # PowerShell start for Windows
├── requirements.txt            # Top-level Python dependencies
├── .gitignore
└── README.md
```

---

## Quickstart

### 1. Prerequisites

- **Python 3.10+** (3.11 or 3.12 recommended)
  - **macOS:** `brew install python@3.11`, or download from [python.org](https://www.python.org/downloads/)
  - **Windows:** download from [python.org](https://www.python.org/downloads/) and tick "Add Python to PATH"
- An Azure AI Foundry project (`MoneyArnold-01`) or an API key, configured in `backend/.env`

### 2. Fastest start (one command)

**macOS / Linux**

```bash
./run.sh
```

If needed, make it executable first with `chmod +x run.sh`. The script:

- finds `python3`
- activates or creates `.venv`
- installs the requirements if they are missing
- copies `backend/.env.example` to `backend/.env` if it does not exist
- starts the FastAPI server with live reload on port 8000

To use another port: `PORT=8080 ./run.sh`

**Windows**

Double-click `run.bat`, or run this in PowerShell:

```powershell
.\run.ps1
```

### 3. Manual start

**macOS / Linux**

```bash
# 1. Create and activate a virtual environment (first time only)
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies (first time only)
pip install -r requirements.txt

# 3. Create your environment file if it does not exist
if [ ! -f backend/.env ]; then cp backend/.env.example backend/.env; fi

# 4. Start the server
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

**Windows (PowerShell)**

```powershell
# 1. Create and activate a virtual environment (first time only)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the server
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### 4. Open the app

Go to **http://localhost:8000**.

- **Demo login:** click **"Instant 1-Click Demo Login"**, or use `demo@gmail.com` / `demo1234`.
- **AI Assistant:** open the **AI Assistant** tab in the sidebar and ask any question to get bulleted insights from your Azure AI Foundry agent.

### 5. Check the Azure AI Foundry connection

This script tests your Azure credentials and lists the agents it finds:

```bash
cd backend
python test_foundry.py
```

---

## Configuration

Settings live in `backend/.env`, which is created from `backend/.env.example`.

- Fill in your Azure AI Foundry endpoint and IDs there.
- `.env` is listed in `.gitignore`, so it is never committed. **Do not commit your keys.**

---

## Deploying to Azure App Service

For a demo, you can deploy the backend and frontend together to **Azure App Service (Linux)**:

```bash
# 1. Log in and choose your subscription
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID_OR_NAME>"

# 2. Deploy from the backend folder
cd backend
az webapp up --runtime "PYTHON:3.11" --sku B1 --name financial-buddy-prototype

# 3. Point the app at your Foundry project
az webapp config appsettings set \
  --name financial-buddy-prototype \
  --settings AZURE_AI_PROJECT_ENDPOINT="https://MoneyArnold-01.services.ai.azure.com/api/projects/MoneyArnold-01"

# 4. Turn on Managed Identity for passwordless Azure sign-in
az webapp identity assign --name financial-buddy-prototype
```

Then, in the Azure Portal:

1. Open your **Azure AI Services / Foundry** resource (`MoneyArnold-01`).
2. Go to **Access Control (IAM)** and choose **Add role assignment**.
3. Pick the role **Azure AI Developer** (or **Cognitive Services OpenAI User**).
4. Assign access to **Managed Identity** and select your `financial-buddy-prototype` App Service.
5. Save. The deployed app can now reach Azure Foundry without storing any secrets.

---

## Prototype Safety Note

This application runs **only simulated actions**. When a user confirms a fund reservation or payment in the UI, the app updates the session state and the audit log in `financial_data.json`. No real bank accounts, cards or payment gateways are ever accessed.

---

## Limitations

- Financial data comes from a local JSON file, not from live bank or account feeds.
- Results depend on the Azure AI Foundry agents being reachable and configured.
- This is a college prototype and is **not financial advice**.

---

## Future Work

- **Online aggregator:** pull a user's transactions from online sources automatically instead of using a local file. This was planned but is not built yet.
- **Real database:** replace the JSON file with a proper database for multiple users.
- **Automated tests:** add tests for the API endpoints and the data models.

<!-- Screenshots: add images to a docs/ folder, then uncomment the lines below.

## Screenshots

![Dashboard](docs/dashboard.png)
![AI Assistant](docs/ai-assistant.png)
-->

---

## Team

Built by:

- [NR-2102](https://github.com/NR-2102)
- [PaarthGaur](https://github.com/PaarthGaur)
- [Himanshu Madhok](https://github.com/hmadhok005)