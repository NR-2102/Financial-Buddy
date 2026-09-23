#!/usr/bin/env bash

# ========================================================
#   Starting MoneyArnold - Financial Buddy (macOS / Linux)
# ========================================================

set -e

# Terminal colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}  Starting MoneyArnold - Financial Buddy (macOS/Linux)  ${NC}"
echo -e "${CYAN}========================================================${NC}"
echo ""

# Resolve project root and backend directories portably
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
BACKEND_DIR="$ROOT_DIR/backend"

# Locate Python 3 executable on host system
if command -v python3 >/dev/null 2>&1; then
    HOST_PYTHON="python3"
elif command -v python >/dev/null 2>&1; then
    HOST_PYTHON="python"
else
    echo -e "${RED}[ERROR] Python 3 is not found on your system.${NC}"
    echo "Please install Python 3.10+ (e.g. via Homebrew: 'brew install python@3.11' or python.org)."
    exit 1
fi

# Detect existing virtual environment or create one
VENV_FOUND=""
if [ -f "$ROOT_DIR/.venv/bin/activate" ]; then
    VENV_FOUND="$ROOT_DIR/.venv"
elif [ -f "$BACKEND_DIR/.venv/bin/activate" ]; then
    VENV_FOUND="$BACKEND_DIR/.venv"
elif [ -f "$BACKEND_DIR/venv/bin/activate" ]; then
    VENV_FOUND="$BACKEND_DIR/venv"
elif [ -f "$ROOT_DIR/venv/bin/activate" ]; then
    VENV_FOUND="$ROOT_DIR/venv"
fi

if [ -n "$VENV_FOUND" ]; then
    echo -e "${YELLOW}Activating virtual environment (${VENV_FOUND})...${NC}"
    # shellcheck source=/dev/null
    source "$VENV_FOUND/bin/activate"
else
    echo -e "${YELLOW}No virtual environment found. Creating one at .venv...${NC}"
    "$HOST_PYTHON" -m venv "$ROOT_DIR/.venv"
    # shellcheck source=/dev/null
    source "$ROOT_DIR/.venv/bin/activate"
    echo -e "${GREEN}Virtual environment created and activated.${NC}"
    
    echo -e "${YELLOW}Installing dependencies from requirements.txt...${NC}"
    pip install --upgrade pip
    if [ -f "$ROOT_DIR/requirements.txt" ]; then
        pip install -r "$ROOT_DIR/requirements.txt"
    elif [ -f "$BACKEND_DIR/requirements.txt" ]; then
        pip install -r "$BACKEND_DIR/requirements.txt"
    fi
    echo -e "${GREEN}Dependencies installed successfully.${NC}"
fi

# Ensure .env exists in backend
if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$BACKEND_DIR/.env.example" ]; then
    echo -e "${YELLOW}No backend/.env found. Creating from .env.example...${NC}"
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

# Verify FastAPI and Uvicorn are installed in active environment
if ! python -c "import fastapi, uvicorn" >/dev/null 2>&1; then
    echo -e "${YELLOW}Required packages not detected in environment. Installing...${NC}"
    if [ -f "$ROOT_DIR/requirements.txt" ]; then
        pip install -r "$ROOT_DIR/requirements.txt"
    else
        pip install -r "$BACKEND_DIR/requirements.txt"
    fi
fi

# Port selection (default 8000, customizable via PORT env var)
PORT="${PORT:-8000}"

cd "$BACKEND_DIR"

echo ""
echo -e "${GREEN}FastAPI server launching with Azure AI Foundry integration...${NC}"
echo -e "${GREEN}Open your browser at: http://localhost:${PORT}${NC}"
echo -e "Press ${YELLOW}Ctrl+C${NC} to stop the server."
echo ""

# Start Uvicorn
exec python -m uvicorn app.main:app --reload --port "$PORT"
