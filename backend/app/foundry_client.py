import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("financial_buddy.foundry")

def format_as_bullet_points(text: str) -> str:
    """Converts any text or paragraph into clean bullet points with each point on its own new line."""
    if not text or not str(text).strip():
        return ""
    import re
    raw = str(text).strip()
    raw_lines = [l.strip() for l in raw.split("\n") if l.strip()]
    bullet_lines = []
    
    for line in raw_lines:
        # If line contains multiple bullet points merged on same line (e.g. "• Point 1 • Point 2")
        parts = re.split(r'(?=[•\-\*]\s+)', line)
        for part in parts:
            p = part.strip()
            if not p:
                continue
            if p.startswith("•") or p.startswith("- ") or p.startswith("* "):
                cleaned = p.lstrip("•-* ").strip()
                if cleaned:
                    bullet_lines.append(f"• {cleaned}")
            elif re.match(r'^\d+[\.\)]\s*', p):
                cleaned = re.sub(r'^\d+[\.\)]\s*', '', p).strip()
                if cleaned:
                    bullet_lines.append(f"• {cleaned}")
            else:
                # If it's a long sentence or paragraph, split by sentence into individual bullet points
                if len(p) > 100 and (". " in p or "? " in p or "! " in p):
                    sentences = re.split(r'(?<=[.!?])\s+', p)
                    for s in sentences:
                        s_clean = s.strip().lstrip("•-* ").strip()
                        if s_clean:
                            bullet_lines.append(f"• {s_clean}")
                else:
                    bullet_lines.append(f"• {p}")
                    
    return "\n".join(bullet_lines)

class FoundryClient:
    def __init__(self):
        self.endpoint = os.getenv(
            "AZURE_AI_PROJECT_ENDPOINT",
            "https://MoneyArnold-01.services.ai.azure.com/api/projects/MoneyArnold-01"
        )
        self.api_key = os.getenv("AZURE_AI_PROJECT_KEY") or os.getenv("AZURE_OPENAI_API_KEY") or ""
        self.tenant_id = os.getenv("AZURE_TENANT_ID") or ""
        self.client_id = os.getenv("AZURE_CLIENT_ID") or ""
        self.client_secret = os.getenv("AZURE_CLIENT_SECRET") or ""
        self.agent_id = os.getenv("AZURE_AI_AGENT_ID") or os.getenv("FOUNDRY_AGENT_ID") or ""
        self.workflow_id = os.getenv("FOUNDRY_WORKFLOW_ID") or ""
        self.analyzer_id = os.getenv("AGENT_ANALYZER_ID") or ""
        self.planner_id = os.getenv("AGENT_PLANNER_ID") or ""
        self.action_id = os.getenv("AGENT_ACTION_ID") or ""
        self.summarizer_id = os.getenv("AGENT_SUMMARIZER_ID") or ""
        self.use_mock_fallback = os.getenv("USE_MOCK_FALLBACK", "false").lower() == "true"
        
        self._project_client = None
        self._agents_discovered = False
        self._last_discovery = {}

    def get_config(self) -> Dict[str, Any]:
        """Returns the current active Azure AI Foundry configuration."""
        return {
            "endpoint": self.endpoint,
            "has_api_key": bool(self.api_key),
            "agent_id": self.agent_id,
            "workflow_id": self.workflow_id,
            "analyzer_id": self.analyzer_id,
            "planner_id": self.planner_id,
            "action_id": self.action_id,
            "summarizer_id": self.summarizer_id,
            "use_mock_fallback": self.use_mock_fallback,
            "auth_method": "API Key" if self.api_key else ("Service Principal" if (self.tenant_id and self.client_id) else "Azure Identity (CLI / Default)")
        }

    def update_config(self, cfg: Dict[str, Any]) -> Dict[str, Any]:
        """Dynamically updates Foundry settings at runtime."""
        if "endpoint" in cfg and cfg["endpoint"]:
            self.endpoint = cfg["endpoint"].strip()
        if "api_key" in cfg:
            self.api_key = cfg["api_key"].strip() if cfg["api_key"] else ""
        if "agent_id" in cfg:
            self.agent_id = cfg["agent_id"].strip() if cfg["agent_id"] else ""
        if "workflow_id" in cfg:
            self.workflow_id = cfg["workflow_id"].strip() if cfg["workflow_id"] else ""
        if "analyzer_id" in cfg:
            self.analyzer_id = cfg["analyzer_id"].strip() if cfg["analyzer_id"] else ""
        if "planner_id" in cfg:
            self.planner_id = cfg["planner_id"].strip() if cfg["planner_id"] else ""
        if "action_id" in cfg:
            self.action_id = cfg["action_id"].strip() if cfg["action_id"] else ""
        if "summarizer_id" in cfg:
            self.summarizer_id = cfg["summarizer_id"].strip() if cfg["summarizer_id"] else ""
        if "use_mock_fallback" in cfg:
            self.use_mock_fallback = bool(cfg["use_mock_fallback"])

        # Invalidate client and agent discovery cache on update
        self._project_client = None
        self._agents_discovered = False
        return self.get_config()

    def get_client(self):
        """Initializes and returns the Azure AIProjectClient supporting API Key, Service Principal, or Azure CLI."""
        if self._project_client is None:
            try:
                from azure.ai.projects import AIProjectClient

                # 1. Option: Direct Project / Azure OpenAI API Key
                if self.api_key:
                    from azure.core.credentials import AzureKeyCredential
                    self._project_client = AIProjectClient(
                        endpoint=self.endpoint,
                        credential=AzureKeyCredential(self.api_key),
                        allow_preview=True
                    )
                    logger.info("Initialized AIProjectClient with AzureKeyCredential.")

                # 2. Option: Azure Service Principal credentials
                elif self.tenant_id and self.client_id and self.client_secret:
                    from azure.identity import ClientSecretCredential
                    cred = ClientSecretCredential(
                        tenant_id=self.tenant_id,
                        client_id=self.client_id,
                        client_secret=self.client_secret
                    )
                    self._project_client = AIProjectClient(
                        endpoint=self.endpoint,
                        credential=cred,
                        allow_preview=True
                    )
                    logger.info("Initialized AIProjectClient with ClientSecretCredential.")

                # 3. Option: DefaultAzureCredential (excluding IMDS / Workload Identity to prevent 25s local hangs)
                else:
                    from azure.identity import DefaultAzureCredential
                    has_service_principal_env = bool(os.getenv("AZURE_CLIENT_ID") and os.getenv("AZURE_TENANT_ID") and os.getenv("AZURE_CLIENT_SECRET"))
                    cred = DefaultAzureCredential(
                        exclude_managed_identity_credential=True,
                        exclude_workload_identity_credential=True,
                        exclude_environment_credential=not has_service_principal_env
                    )
                    self._project_client = AIProjectClient(
                        endpoint=self.endpoint,
                        credential=cred,
                        allow_preview=True
                    )
                    logger.info("Initialized AIProjectClient with DefaultAzureCredential (fast local mode).")
            except Exception as e:
                logger.warning(f"Could not initialize Azure AIProjectClient: {e}")
                return None
        return self._project_client

    def discover_agents(self, force: bool = False) -> Dict[str, str]:
        """Auto-discovers Agent IDs from Azure AI Foundry if not manually specified."""
        if self._agents_discovered and not force:
            return self._last_discovery

        discovered = {}

        # 1. Primary method: Direct Azure AI Foundry REST API using API Key
        if self.api_key and self.endpoint:
            try:
                import httpx
                r = httpx.get(
                    f"{self.endpoint}/agents?api-version=v1",
                    headers={"api-key": self.api_key},
                    timeout=15.0
                )
                if r.status_code == 200:
                    data = r.json().get("data", [])
                    for a in data:
                        name = a.get("name") or a.get("id")
                        aid = a.get("id")
                        latest = a.get("versions", {}).get("latest", {})
                        guid = latest.get("agent_guid")
                        if name and aid:
                            discovered[name] = aid
                        if guid and aid:
                            discovered[guid] = aid
                    logger.info(f"Discovered Azure AI Foundry Agents via REST API: {list(discovered.keys())}")
            except Exception as e:
                logger.debug(f"Direct Foundry REST agents discovery error: {e}")

        # 2. Secondary method: Azure AIProjectClient SDK / Assistants API
        if not discovered:
            client = self.get_client()
            if client:
                try:
                    if hasattr(client.agents, "list"):
                        for agent in client.agents.list():
                            name = getattr(agent, "name", "")
                            aid = getattr(agent, "id", "")
                            if name and aid:
                                discovered[name] = aid
                    elif hasattr(client.agents, "list_agents"):
                        for agent in client.agents.list_agents().data:
                            name = getattr(agent, "name", "")
                            aid = getattr(agent, "id", "")
                            if name and aid:
                                discovered[name] = aid
                except Exception as e:
                    logger.debug(f"client.agents.list check: {e}")

                try:
                    openai_client = client.get_openai_client()
                    assts = openai_client.beta.assistants.list()
                    for asst in assts.data:
                        name = asst.name or ""
                        aid = asst.id
                        if name and aid and name not in discovered:
                            discovered[name] = aid
                except Exception as e:
                    logger.debug(f"openai_client.beta.assistants check: {e}")

        # Map discovered agent roles if not explicitly pinned
        for name, aid in discovered.items():
            name_lower = name.lower()
            if not self.analyzer_id and ("agent-1" in name_lower or "categor" in name_lower or "analyzer" in name_lower):
                self.analyzer_id = aid
            elif not self.planner_id and ("agent-2" in name_lower or "budget" in name_lower or "planner" in name_lower):
                self.planner_id = aid
            elif not self.action_id and ("agent-3" in name_lower or "alert" in name_lower or "action" in name_lower):
                self.action_id = aid
            elif not self.summarizer_id and ("agent-4" in name_lower or "summar" in name_lower or "synthes" in name_lower):
                self.summarizer_id = aid
            elif not self.agent_id and ("agent-4" in name_lower):
                self.agent_id = aid
            elif not self.workflow_id and ("workflow" in name_lower or "transaction" in name_lower):
                self.workflow_id = aid

        self._agents_discovered = True
        self._last_discovery = discovered
        return discovered

    def _execute_agent(self, agent_id: str, prompt_content: str) -> Optional[Dict[str, Any]]:
        """Invokes the specified Azure AI Foundry agent and returns parsed response."""
        # 1. Primary Direct Route: Azure AI Foundry REST Execution via API Key
        if self.api_key and self.endpoint:
            try:
                import httpx
                from urllib.parse import urlparse

                # Resolve agent identifier if it's a GUID alias
                resolved_id = agent_id
                if not self._agents_discovered:
                    self.discover_agents()
                if agent_id in self._last_discovery:
                    resolved_id = self._last_discovery[agent_id]

                # Fetch agent instructions and model definition from Foundry Project
                instructions = ""
                model = "gpt-5-mini"
                agent_meta_url = f"{self.endpoint}/agents/{resolved_id}?api-version=v1"
                try:
                    r = httpx.get(agent_meta_url, headers={"api-key": self.api_key}, timeout=15.0)
                    if r.status_code == 200:
                        data = r.json()
                        latest = data.get("versions", {}).get("latest", {})
                        defn = latest.get("definition", {})
                        instructions = defn.get("instructions", "")
                        model = defn.get("model") or "gpt-5-mini"
                except Exception as e:
                    logger.debug(f"Could not fetch agent metadata for {resolved_id}: {e}")

                # Call Azure AI Foundry model endpoint
                parsed_endpoint = urlparse(self.endpoint)
                base_url = f"{parsed_endpoint.scheme}://{parsed_endpoint.netloc}"
                chat_url = f"{base_url}/models/chat/completions?api-version=2024-05-01-preview"

                messages = []
                system_prompt = (
                    (instructions or "You are the Executive Financial Summarizer for Financial Buddy.")
                    + "\n\nCRITICAL INSTRUCTIONS:\n"
                    + "1. Return a valid JSON object matching your schema.\n"
                    + "2. In 'executive_summary.headline', provide a concise 1-sentence verdict.\n"
                    + "3. In 'executive_summary.key_takeaways', provide distinct, concise bullet items (each focusing on: spending observations, cash flow forecast, liquidity obligations, and actionable next steps).\n"
                    + "4. Do NOT output raw text outside the JSON."
                )
                messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt_content})

                logger.info(f"Invoking Azure AI Foundry agent '{resolved_id}' (model: {model}) at {chat_url}...")
                resp = httpx.post(
                    chat_url,
                    headers={"api-key": self.api_key, "Content-Type": "application/json"},
                    json={"model": model, "messages": messages},
                    timeout=60.0
                )
                if resp.status_code == 200:
                    choice = resp.json()["choices"][0]["message"]["content"]
                    return self._parse_agent_response(choice)
                else:
                    logger.error(f"Foundry agent execution failed ({resp.status_code}): {resp.text[:300]}")
            except Exception as e:
                logger.error(f"Error calling Azure Foundry REST API for agent {agent_id}: {e}")

        # 2. Fallback: OpenAI Assistants Thread Execution
        client = self.get_client()
        if not client:
            return None

        try:
            openai_client = client.get_openai_client()
            thread = openai_client.beta.threads.create()
            openai_client.beta.threads.messages.create(
                thread_id=thread.id,
                role="user",
                content=prompt_content
            )
            run = openai_client.beta.threads.runs.create_and_poll(
                thread_id=thread.id,
                assistant_id=agent_id
            )

            if run.status != "completed":
                logger.error(f"Run ended with status: {run.status}")
                return None

            messages = openai_client.beta.threads.messages.list(thread_id=thread.id)
            for msg in messages.data:
                if msg.role == "assistant" and msg.content:
                    raw_text = msg.content[0].text.value
                    return self._parse_agent_response(raw_text)
        except Exception as e:
            logger.error(f"Error executing agent {agent_id} via OpenAI client: {e}")
            return None

    def _parse_agent_response(self, text: str) -> Dict[str, Any]:
        """Safely parses agent output, extracting JSON blocks if present or structuring plain text into bullet points."""
        cleaned = self._clean_json_string(text)
        parsed = None
        try:
            parsed = json.loads(cleaned)
        except Exception:
            # Try finding a JSON object within the text using regex
            import re
            json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if json_match:
                try:
                    parsed = json.loads(json_match.group(0))
                except Exception:
                    pass

        if isinstance(parsed, dict):
            # Check for Agent-4 executive summary structure
            if "executive_summary" in parsed and isinstance(parsed["executive_summary"], dict):
                exec_sum = parsed["executive_summary"]
                headline = exec_sum.get("headline", "").strip()
                takeaways = exec_sum.get("key_takeaways", [])
                
                bullet_list = []
                if headline:
                    clean_head = headline.lstrip("•-* ").strip()
                    bullet_list.append(f"• **Overview:** {clean_head}")
                for t in takeaways:
                    t_str = str(t).strip().lstrip("•-* ").strip()
                    if t_str:
                        bullet_list.append(f"• {t_str}")
                
                # Check consolidated report if no takeaways
                consolidated = parsed.get("consolidated_report")
                if isinstance(consolidated, dict) and not takeaways:
                    for k, val in consolidated.items():
                        if val and isinstance(val, str) and val.strip():
                            clean_v = val.strip().lstrip("•-* ").strip()
                            label = k.replace("_", " ").title()
                            bullet_list.append(f"• **{label}:** {clean_v}")
                
                # Check action required
                action_info = parsed.get("action_required")
                if isinstance(action_info, dict) and action_info.get("action_summary"):
                    act_text = action_info["action_summary"].strip().lstrip("•-* ").strip()
                    if act_text and act_text.lower() not in [str(t).lower() for t in takeaways]:
                        bullet_list.append(f"• **Recommended Action:** {act_text}")
                
                formatted_msg = "\n\n".join(bullet_list) if bullet_list else format_as_bullet_points(str(parsed))
                parsed["message"] = formatted_msg
                parsed["executive_summary"] = formatted_msg
            elif "message" in parsed:
                parsed["message"] = format_as_bullet_points(str(parsed["message"]))
            elif "summary" in parsed:
                parsed["message"] = format_as_bullet_points(str(parsed["summary"]))
            else:
                parsed["message"] = format_as_bullet_points(text)

            if "financial_health_score" in parsed and isinstance(parsed["financial_health_score"], dict):
                parsed["health_score"] = parsed["financial_health_score"].get("status", "Healthy")
            return parsed

        # Return natural language response gracefully packaged as bullet points
        bullet_msg = format_as_bullet_points(text)
        return {
            "status": "success",
            "summary": text[:200] + ("..." if len(text) > 200 else ""),
            "message": bullet_msg,
            "understanding": bullet_msg,
            "raw_text": text
        }

    def _clean_json_string(self, text: str) -> str:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        # If output was prefixed with bullet markers e.g. "• {", strip them
        if "• {" in text or "•  {" in text or text.startswith("•"):
            import re
            text = re.sub(r'^[•\-\*]\s*', '', text, flags=re.MULTILINE)
        return text.strip()

    def run_pipeline(self, financial_data: Dict[str, Any], user_query: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes the Financial Buddy workflow:
        Option 1: If an Agent ID / Workflow ID is configured, invokes the user's Foundry agent directly.
        Option 2: Sequentially chains Agent 1 (Analyzer) -> Agent 2 (Planner) -> Agent 3 (Alert & Action) -> Agent 4 (Summarizer).
        Option 3: Falls back to verified test data if offline or credentials not yet provided.
        """
        client = self.get_client()

        if client and not self.use_mock_fallback:
            self.discover_agents()

            # Path A: Single Agent or Workflow Agent invocation
            target_agent = self.agent_id or self.workflow_id or (self.summarizer_id if not (self.analyzer_id and self.planner_id) else None)
            if target_agent:
                logger.info(f"Invoking Foundry Agent: {target_agent}")
                agent_input = {
                    "user_query": user_query or "Provide an executive summary of my financial state and any recommendations.",
                    "financial_context": {
                        "profile": financial_data.get("profile", {}),
                        "accounts": financial_data.get("accounts", []),
                        "budgets": financial_data.get("budgets", []),
                        "transactions": financial_data.get("transactions", []),
                        "bills": financial_data.get("bills", []),
                        "subscriptions": financial_data.get("subscriptions", [])
                    },
                    "instructions": "Synthesize the user's financial facts and directly answer their inquiry in a clear, concise, conversational tone."
                }
                result = self._execute_agent(target_agent, json.dumps(agent_input))
                if result:
                    msg_output = result.get("message") or result.get("executive_summary") or result.get("summary") or result.get("raw_text") or str(result)
                    analyzer_res = result.get("analyzer", {})
                    planner_res = result.get("planner", {})
                    alert_res = result if "agent" in result and result["agent"] == "alert_action" else result.get("alert_action", result)
                    summarizer_res = result.get("summarizer") or {
                        "executive_summary": msg_output,
                        "health_score": result.get("health_score", "Healthy & Stable"),
                        "key_takeaways": result.get("key_takeaways", []),
                        "synthesized_from": ["Azure AI Foundry Agent"]
                    }
                    return {
                        "execution_mode": "foundry_agent",
                        "agent_id": target_agent,
                        "message": msg_output,
                        "analyzer": analyzer_res,
                        "planner": planner_res,
                        "alert_action": alert_res,
                        "summarizer": summarizer_res,
                        "status": "success"
                    }

            # Path B: Sequential Agent Chaining (4-Agent Pipeline)
            if self.analyzer_id and self.planner_id and self.action_id:
                logger.info("Executing 4-Agent Sequential Pipeline in Azure AI Foundry...")
                
                # Step 1: Agent 1 - Financial Analyzer
                analyzer_input = {
                    "transactions": financial_data.get("transactions", []),
                    "budgets": financial_data.get("budgets", []),
                    "instructions": "Categorize transactions, monitor budget utilization, and identify subscriptions/unbudgeted expenses."
                }
                analyzer_res = self._execute_agent(self.analyzer_id, json.dumps(analyzer_input))

                # Step 2: Agent 2 - Financial Planner
                if analyzer_res:
                    planner_input = {
                        "analyzer_results": analyzer_res,
                        "profile": financial_data.get("profile", {}),
                        "instructions": "Perform cash-flow forecasting (30/60/90 days), calculate savings goal gap, and assess affordability of planned purchase."
                    }
                    planner_res = self._execute_agent(self.planner_id, json.dumps(planner_input))

                    # Step 3: Agent 3 - Alert & Action
                    if planner_res:
                        action_input = {
                            "analyzer_results": analyzer_res,
                            "planner_results": planner_res,
                            "profile": financial_data.get("profile", {}),
                            "instructions": "Generate proactive alerts, highlight budget and emergency shortfalls, and create confirmation-based mock financial action."
                        }
                        action_res = self._execute_agent(self.action_id, json.dumps(action_input))

                        if action_res:
                            # Step 4: Agent 4 - Financial Summarizer & Synthesizer
                            summarizer_res = None
                            if self.summarizer_id:
                                logger.info(f"Invoking Foundry Agent 4 (Summarizer): {self.summarizer_id}")
                                summarizer_input = {
                                    "analyzer_results": analyzer_res,
                                    "planner_results": planner_res,
                                    "action_results": action_res,
                                    "profile": financial_data.get("profile", {}),
                                    "instructions": "Synthesize the findings of the Financial Analyzer, Financial Planner, and Alert & Action agents into a concise executive financial summary with actionable takeaways and overall health status."
                                }
                                summarizer_res = self._execute_agent(self.summarizer_id, json.dumps(summarizer_input))
                            
                            if not summarizer_res:
                                summarizer_res = self._generate_simulated_summary(analyzer_res, planner_res, action_res, financial_data)

                            return {
                                "execution_mode": "foundry_live_chain",
                                "analyzer": analyzer_res,
                                "planner": planner_res,
                                "alert_action": action_res,
                                "summarizer": summarizer_res,
                                "status": "success"
                            }

        # Path C: Verified Simulation Fallback
        logger.info("Using verified local test outputs (USE_MOCK_FALLBACK or Foundry unavailable).")
        return self.get_verified_mock_output(financial_data)

    def get_verified_mock_output(self, financial_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Dynamically calculates multi-agent outputs from user's current financial_data store.
        Matches the exact logic and schema of the 3 Foundry agents.
        """
        profile = financial_data.get("profile", {})
        accounts = financial_data.get("accounts", [])
        if accounts:
            curr_bal = sum(float(a.get("balance", 0)) for a in accounts)
        else:
            curr_bal = float(profile.get("current_balance", 0.0))

        bills_list = financial_data.get("bills", [])
        if bills_list:
            bills_amt = sum(float(b.get("amount", 0)) for b in bills_list if b.get("status") != "paid")
        else:
            bills_amt = float(profile.get("upcoming_bills", 0.0))

        income = float(profile.get("monthly_income", 0.0))
        expenses = float(profile.get("monthly_expenses", 0.0))
        surplus = max(0.0, income - expenses)
        curr_savings = float(profile.get("current_savings", 0.0))
        savings_goal = float(profile.get("savings_goal", 0.0))
        
        planned_purchase = profile.get("planned_purchase") or {"item": "", "amount": 0.0}
        item_name = planned_purchase.get("item", "Planned Purchase")
        purchase_amt = float(planned_purchase.get("amount", 0.0))

        raw_txs = financial_data.get("transactions", [])
        budgets_config = financial_data.get("budgets", [])

        # -------------------------------------------------------------
        # 1. Agent 1 Simulation: Categorization & Budget Analysis
        # -------------------------------------------------------------
        categorized_txs = []
        spending_by_category = {b["category"]: 0.0 for b in budgets_config}
        spending_by_category["Bills"] = 0.0
        spending_by_category["Other"] = 0.0

        subscriptions = []
        unbudgeted_items = []

        for tx in raw_txs:
            merchant = tx.get("merchant", "Unknown")
            amt = float(tx.get("amount", 0))
            cat = tx.get("category")
            conf = tx.get("confidence", "high")
            date = tx.get("date")

            m_lower = merchant.lower()
            if not cat or cat == "Pending":
                if any(k in m_lower for k in ["swiggy", "zomato", "restaurant", "cafe", "food", "grocer", "mcdonald"]):
                    cat = "Food"
                    conf = "high"
                elif any(k in m_lower for k in ["uber", "ola", "metro", "fuel", "petrol", "transport", "train"]):
                    cat = "Transport"
                    conf = "high"
                elif any(k in m_lower for k in ["amazon", "flipkart", "myntra", "shopping", "clothes", "book"]):
                    cat = "Shopping"
                    conf = "medium"
                elif any(k in m_lower for k in ["netflix", "spotify", "prime", "movie", "hotstar", "cinema"]):
                    cat = "Entertainment"
                    conf = "high"
                elif any(k in m_lower for k in ["electricity", "power", "water", "wifi", "bill", "recharge", "utility"]):
                    cat = "Bills"
                    conf = "high"
                else:
                    cat = "Other"
                    conf = "medium"

            categorized_txs.append({
                "id": tx.get("id"),
                "merchant": merchant,
                "amount": amt,
                "date": date,
                "category": cat,
                "confidence": conf
            })

            # Check for subscriptions
            if any(k in m_lower for k in ["netflix", "spotify", "prime", "hotstar", "youtube"]):
                subscriptions.append({"service": merchant, "amount": amt, "type": "recurring_subscription", "confidence": "high"})
            
            # Check for unbudgeted essentials
            if cat == "Bills":
                unbudgeted_items.append({"item": f"{merchant} Bill", "amount": amt, "status": "unbudgeted_expense", "note": "Utility expense"})

            spending_by_category[cat] = spending_by_category.get(cat, 0.0) + amt

        # Build budget analysis
        budget_analysis = []
        alerts_agent1 = []
        for b in budgets_config:
            b_name = b["category"]
            b_limit = float(b["amount"])
            spent = spending_by_category.get(b_name, 0.0)
            pct = (spent / b_limit * 100.0) if b_limit > 0 else 0.0
            
            if pct >= 100.0:
                status = "exceeded"
                alerts_agent1.append(f"{b_name} budget exceeded! Spent ₹{spent:,.0f} of ₹{b_limit:,.0f} ({pct:.1f}%).")
            elif pct >= 75.0:
                status = "warning"
                alerts_agent1.append(f"{b_name} budget warning: {pct:.1f}% utilized (₹{spent:,.0f} of ₹{b_limit:,.0f}).")
            else:
                status = "normal"

            budget_analysis.append({
                "budget_name": b_name,
                "budget_amount": b_limit,
                "spending": spent,
                "percentage_used": pct,
                "status": status,
                "remaining": max(0.0, b_limit - spent)
            })

        analyzer_output = {
            "agent": "financial_analyzer",
            "status": "success",
            "categorized_transactions": categorized_txs,
            "budget_analysis": budget_analysis,
            "bills_analysis": unbudgeted_items,
            "subscription_analysis": subscriptions,
            "spending_patterns": [
                {"insight": f"{b['budget_name']} is at {b['percentage_used']:.1f}% of limit."} for b in budget_analysis if b["percentage_used"] > 20
            ],
            "alerts": alerts_agent1,
            "data_needed": []
        }

        # -------------------------------------------------------------
        # 2. Agent 2 Simulation: Financial Planner & Forecasting
        # -------------------------------------------------------------
        balance_after_purchase = curr_bal - purchase_amt
        fc_30_before = curr_bal + surplus - bills_amt
        fc_30_after = balance_after_purchase + surplus - bills_amt
        fc_60_before = curr_bal + (2 * surplus) - bills_amt
        fc_60_after = balance_after_purchase + (2 * surplus) - bills_amt
        fc_90_before = curr_bal + (3 * surplus) - bills_amt
        fc_90_after = balance_after_purchase + (3 * surplus) - bills_amt

        goal_gap = max(0.0, savings_goal - curr_savings)
        months_to_goal = round(goal_gap / surplus, 1) if surplus > 0 else 999.0

        # Affordability verdict
        remaining_liquidity_after_all = balance_after_purchase - bills_amt
        if remaining_liquidity_after_all >= expenses:
            affordable = True
            verdict = f"Affordable: Purchasing {item_name} leaves ₹{balance_after_purchase:,.0f} liquid (₹{remaining_liquidity_after_all:,.0f} after reserving ₹{bills_amt:,.0f} bills), which comfortably covers your ₹{expenses:,.0f}/mo expenses."
        elif remaining_liquidity_after_all >= 0:
            affordable = True
            verdict = f"Affordable with caution: Leaves ₹{balance_after_purchase:,.0f} liquid, or ₹{remaining_liquidity_after_all:,.0f} after reserving ₹{bills_amt:,.0f} bills. Cushion for emergency living expenses is tight."
        else:
            affordable = False
            verdict = f"Not recommended: Purchasing {item_name} (₹{purchase_amt:,.0f}) would cause a liquidity deficit of ₹{abs(remaining_liquidity_after_all):,.0f} once upcoming bills are paid."

        planner_output = {
            "agent": "financial_planner",
            "status": "success",
            "cash_flow": {
                "monthly_income": income,
                "monthly_expenses": expenses,
                "monthly_surplus": surplus,
                "balance_after_purchase": balance_after_purchase,
                "forecast_30_days_before": fc_30_before,
                "forecast_30_days_after": fc_30_after,
                "forecast_60_days_before": fc_60_before,
                "forecast_60_days_after": fc_60_after,
                "forecast_90_days_before": fc_90_before,
                "forecast_90_days_after": fc_90_after
            },
            "budget_plan": {
                "recommended_savings_rate": round((surplus / income * 100), 1) if income > 0 else 0,
                "recommended_emergency_buffer": expenses * 2
            },
            "savings_plan": {
                "target_goal": savings_goal,
                "current_savings": curr_savings,
                "goal_gap": goal_gap,
                "months_to_reach_at_surplus": months_to_goal,
                "scenario_with_purchase_from_savings": {
                    "resulting_savings": max(0.0, curr_savings - purchase_amt),
                    "new_gap": goal_gap + purchase_amt,
                    "months_to_goal": round((goal_gap + purchase_amt) / surplus, 1) if surplus > 0 else 999.0
                }
            },
            "goal_analysis": [
                {
                    "goal": g.get("name", "Savings Goal"),
                    "target": float(g.get("target_amount", savings_goal)),
                    "current": float(g.get("current_amount", curr_savings)),
                    "progress_pct": round((float(g.get("current_amount", 0)) / float(g.get("target_amount", 1)) * 100), 1) if float(g.get("target_amount", 0)) > 0 else 0
                } for g in financial_data.get("goals", [])
            ] if financial_data.get("goals") else [
                {"goal": "Emergency Savings Goal", "target": savings_goal, "current": curr_savings, "progress_pct": round((curr_savings / savings_goal * 100), 1) if savings_goal > 0 else 0}
            ],
            "affordability_analysis": {
                "item": item_name,
                "cost": purchase_amt,
                "affordable": affordable,
                "verdict": verdict
            },
            "recommendations": [
                f"Reserve ₹{bills_amt:,.0f} for upcoming bills prior to purchasing {item_name}.",
                f"Allocate monthly surplus of ₹{surplus:,.0f} toward the ₹{goal_gap:,.0f} emergency goal gap ({months_to_goal} months)."
            ],
            "data_needed": []
        }

        # -------------------------------------------------------------
        # 3. Agent 3 Simulation: Alerts & Interactive Confirmation
        # -------------------------------------------------------------
        all_alerts = []
        for b_alert in alerts_agent1:
            all_alerts.append({"level": "warning", "title": "Budget Alert", "message": b_alert})

        if bills_amt > 0:
            all_alerts.append({"level": "info", "title": "Upcoming Bills", "message": f"₹{bills_amt:,.0f} in upcoming bills require reservation."})

        if goal_gap > 0:
            all_alerts.append({"level": "warning", "title": "Emergency Fund Shortfall", "message": f"Emergency fund gap is ₹{goal_gap:,.0f} (~{months_to_goal} months at surplus)."})

        if not affordable:
            all_alerts.append({"level": "danger", "title": "Liquidity Risk", "message": f"High risk: buying {item_name} creates a negative balance of ₹{abs(remaining_liquidity_after_all):,.0f} after bills."})
        else:
            all_alerts.append({"level": "attention", "title": "Post-Purchase Liquidity", "message": f"After {item_name} (₹{purchase_amt:,.0f}) and bills (₹{bills_amt:,.0f}), net liquidity will be ₹{remaining_liquidity_after_all:,.0f}."})

        action_amt = bills_amt if bills_amt > 0 else purchase_amt
        action_type = "reserve_bill_funds" if bills_amt > 0 else "reserve_purchase_funds"
        action_desc = f"Reserve ₹{action_amt:,.0f} from main balance to safeguard upcoming expenses."

        action_output = {
            "agent": "alert_action",
            "status": "success",
            "alerts": all_alerts,
            "user_message": f"Your balance is ₹{curr_bal:,.0f}. To ensure you maintain stability, would you like to reserve ₹{action_amt:,.0f} now?",
            "requires_confirmation": True,
            "action": {
                "type": action_type,
                "description": action_desc,
                "amount": action_amt,
                "status": "pending_confirmation"
            }
        }

        # -------------------------------------------------------------
        # 4. Agent 4 Simulation: Executive Financial Summarizer / Synthesis Agent
        # -------------------------------------------------------------
        summarizer_output = self._generate_simulated_summary(
            analyzer=analyzer_output,
            planner=planner_output,
            alert_action=action_output,
            financial_data=financial_data
        )

        return {
            "execution_mode": "dynamic_simulation",
            "analyzer": analyzer_output,
            "planner": planner_output,
            "alert_action": action_output,
            "summarizer": summarizer_output,
            "status": "success"
        }

    def _generate_simulated_summary(
        self,
        analyzer: Dict[str, Any],
        planner: Dict[str, Any],
        alert_action: Dict[str, Any],
        financial_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Synthesizes the collective outputs of Agent 1, Agent 2, and Agent 3
        into a unified, actionable executive financial briefing and guidance.
        """
        profile = financial_data.get("profile", {})
        accounts = financial_data.get("accounts", [])
        if accounts:
            curr_bal = sum(float(a.get("balance", 0)) for a in accounts)
        else:
            curr_bal = float(profile.get("current_balance", 0.0))

        income = float(profile.get("monthly_income", 0.0))
        expenses = float(profile.get("monthly_expenses", 0.0))
        surplus = max(0.0, income - expenses)

        affordability = planner.get("affordability_analysis", {})
        item_name = affordability.get("item", "Planned Purchase")
        cost = float(affordability.get("cost", 0.0))
        is_affordable = affordability.get("affordable", True)

        alerts = alert_action.get("alerts", [])
        budgets_analysis = analyzer.get("budget_analysis", [])
        exceeded_budgets = [b["budget_name"] for b in budgets_analysis if b.get("percentage_used", 0) >= 100]
        warning_budgets = [b["budget_name"] for b in budgets_analysis if 75 <= b.get("percentage_used", 0) < 100]

        has_danger_alerts = any(a.get("level") == "danger" for a in alerts)

        # Determine overall financial health status
        if has_danger_alerts or (not is_affordable and cost > 0):
            health_score = "Caution Advised"
            health_badge = "badge-danger"
        elif exceeded_budgets or len(warning_budgets) > 1:
            health_score = "Moderate Attention Needed"
            health_badge = "badge-warning"
        elif surplus > 0 and curr_bal > expenses:
            health_score = "Healthy & Stable"
            health_badge = "badge-success"
        else:
            health_score = "Balanced"
            health_badge = "badge-accent"

        # Construct key takeaways
        takeaways = []
        takeaways.append(f"Current Liquidity: ₹{curr_bal:,.0f} with a net monthly cash surplus of ₹{surplus:,.0f}/mo.")
        
        if exceeded_budgets:
            takeaways.append(f"Budget Limit Overrun: {', '.join(exceeded_budgets)} has exceeded the monthly threshold.")
        elif warning_budgets:
            takeaways.append(f"Budget Utilization: {', '.join(warning_budgets)} is approaching maximum limit.")
        else:
            takeaways.append("Spending Stability: Discretionary expenses remain within planned category allocations.")

        if cost > 0:
            status_text = "Affordable with comfortable buffer" if is_affordable else "Poses liquidity risk without pre-reservation"
            takeaways.append(f"Purchase Feasibility ({item_name} @ ₹{cost:,.0f}): {status_text}.")

        if alerts:
            takeaways.append(f"Active Safeguards: {len(alerts)} active safety alert{'s' if len(alerts) > 1 else ''} being monitored.")

        exec_summary = (
            f"**Overall Financial Health:** {health_score}. "
            f"Your liquid balance is **₹{curr_bal:,.0f}** with an estimated monthly surplus of **+₹{surplus:,.0f}**. "
            f"{('Discretionary purchase of ' + item_name + ' (₹' + f'{cost:,.0f}' + ') is feasible with existing cash reserves.' if is_affordable else 'Recommended to defer discretionary purchase of ' + item_name + ' until upcoming obligations are reserved.') if cost > 0 else 'Your overall cash flow supports ongoing emergency reserve building.'} "
            f"Based on comprehensive cash flow analysis, budget utilization, and scheduled obligations."
        )

        return {
            "agent": "financial_summarizer",
            "stage": "4",
            "status": "success",
            "health_score": health_score,
            "health_badge": health_badge,
            "executive_summary": exec_summary,
            "key_takeaways": takeaways,
            "synthesized_from": ["financial_analyzer", "financial_planner", "alert_action"]
        }
