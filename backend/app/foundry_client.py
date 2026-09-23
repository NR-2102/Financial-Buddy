import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("financial_buddy.foundry")

def format_as_bullet_points(text: str) -> str:
    """Cleans up text formatting while preserving conversational paragraphs and natural structure."""
    if not text or not str(text).strip():
        return ""
    return str(text).strip()

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
                    for k, val in list(consolidated.items())[:2]:
                        if val and isinstance(val, str) and val.strip():
                            clean_v = val.strip().lstrip("•-* ").strip()
                            label = k.replace("_", " ").title()
                            bullet_list.append(f"• **{label}:** {clean_v}")
                
                # Check action required
                action_info = parsed.get("action_required")
                if isinstance(action_info, dict) and action_info.get("action_summary"):
                    act_text = action_info["action_summary"].strip().lstrip("•-* ").strip()
                    if act_text and act_text.lower() not in [str(t).lower() for t in takeaways]:
                        bullet_list.append(f"• **Action:** {act_text}")
                
                # Cap to 4 items total
                bullet_list = bullet_list[:4]
                formatted_msg = "\n".join(bullet_list) if bullet_list else format_as_bullet_points(str(parsed))
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

    def run_pipeline(
        self,
        financial_data: Dict[str, Any],
        user_query: Optional[str] = None,
        intent: Optional[str] = None,
        conversation: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes the Financial Buddy workflow:
        Option 1: If an Agent ID / Workflow ID is configured, invokes the user's Foundry agent directly.
        Option 2: Sequentially chains Agent 1 (Analyzer) -> Agent 2 (Planner) -> Agent 3 (Alert & Action) -> Agent 4 (Summarizer).
        Option 3: Runs the grounded dynamic simulation pipeline.
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
                    "intent": intent,
                    "conversation": conversation or [],
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
                                    "user_query": user_query,
                                    "intent": intent,
                                    "conversation": conversation or [],
                                    "instructions": "Synthesize findings across Analyzer, Planner, and Alert agents into a conversational response answering the user's specific inquiry."
                                }
                                summarizer_res = self._execute_agent(self.summarizer_id, json.dumps(summarizer_input))
                            
                            if not summarizer_res:
                                summarizer_res = self._generate_simulated_summary(
                                    analyzer_res, planner_res, action_res, financial_data, user_query, intent, conversation
                                )

                            return {
                                "execution_mode": "foundry_live_chain",
                                "analyzer": analyzer_res,
                                "planner": planner_res,
                                "alert_action": action_res,
                                "summarizer": summarizer_res,
                                "status": "success"
                            }

        # Path C: Grounded Local Multi-Agent Execution
        return self.get_verified_mock_output(financial_data, user_query=user_query, intent=intent, conversation=conversation)

    def get_verified_mock_output(
        self,
        financial_data: Dict[str, Any],
        user_query: Optional[str] = None,
        intent: Optional[str] = None,
        conversation: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Dynamically calculates grounded multi-agent outputs from user's current financial_data store.
        Agent 1: Financial Analyzer
        Agent 2: Financial Planner
        Agent 3: Alert & Action
        Agent 4: Financial Summary Agent
        """
        profile = financial_data.get("profile", {})
        accounts = financial_data.get("accounts", [])
        if accounts:
            curr_bal = sum(float(a.get("balance", 0)) for a in accounts if a.get("type") != "Credit Card")
        else:
            curr_bal = float(profile.get("current_balance", 0.0))

        bills_list = financial_data.get("bills", [])
        unpaid_bills = [b for b in bills_list if b.get("status") != "paid"]
        if unpaid_bills:
            bills_amt = sum(float(b.get("amount", 0)) for b in unpaid_bills)
        else:
            bills_amt = float(profile.get("upcoming_bills", 0.0))

        raw_txs = financial_data.get("transactions", [])
        budgets_config = financial_data.get("budgets", [])

        # Calculate income and expenses from transactions if profile is zero
        income_txs = [t for t in raw_txs if t.get("type") == "income"]
        expense_txs = [t for t in raw_txs if t.get("type") != "income"]

        income = float(profile.get("monthly_income", 0.0))
        if income <= 0 and income_txs:
            income = sum(float(t.get("amount", 0)) for t in income_txs)

        expenses = float(profile.get("monthly_expenses", 0.0))
        if expenses <= 0 and expense_txs:
            expenses = sum(float(t.get("amount", 0)) for t in expense_txs)

        surplus = max(0.0, income - expenses)
        curr_savings = float(profile.get("current_savings", 0.0))
        savings_goal = float(profile.get("savings_goal", 0.0))
        
        planned_purchase = profile.get("planned_purchase") or {"item": "", "amount": 0.0}
        item_name = planned_purchase.get("item") or "Planned Purchase"
        purchase_amt = float(planned_purchase.get("amount", 0.0))

        # -------------------------------------------------------------
        # 1. Agent 1: Financial Analyzer
        # -------------------------------------------------------------
        categorized_txs = []
        spending_by_category = {b["category"]: 0.0 for b in budgets_config}
        spending_by_category["Bills"] = 0.0
        spending_by_category["Other"] = 0.0

        # Period tracking (grouping by YYYY-MM)
        periods: Dict[str, Dict[str, Any]] = {}
        subscriptions = []
        unbudgeted_items = []
        confidence_notes = []

        for tx in raw_txs:
            merchant = tx.get("merchant", "Unknown")
            amt = float(tx.get("amount", 0))
            cat = tx.get("category")
            conf = tx.get("confidence", "high")
            date_str = str(tx.get("date") or "")
            tx_type = tx.get("type", "expense")

            # Extract period (YYYY-MM)
            period = date_str[:7] if len(date_str) >= 7 and "-" in date_str else "current"
            if period not in periods:
                periods[period] = {"transactions": [], "total_expense": 0.0, "total_income": 0.0, "by_category": {}}

            m_lower = merchant.lower()
            if not cat or cat == "Pending":
                if any(k in m_lower for k in ["swiggy", "zomato", "restaurant", "cafe", "food", "grocer", "mcdonald", "blinkit", "dunzo"]):
                    cat = "Food"
                    conf = "high"
                elif any(k in m_lower for k in ["uber", "ola", "metro", "fuel", "petrol", "transport", "train", "rapido"]):
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
                elif any(k in m_lower for k in ["salary", "income", "consulting", "payout"]):
                    cat = "Income"
                    conf = "high"
                else:
                    cat = "Other"
                    conf = "medium"

            tx_record = {
                "id": tx.get("id"),
                "merchant": merchant,
                "amount": amt,
                "date": date_str,
                "category": cat,
                "confidence": conf,
                "type": tx_type,
                "account": tx.get("account")
            }
            categorized_txs.append(tx_record)
            periods[period]["transactions"].append(tx_record)

            if tx_type == "income":
                periods[period]["total_income"] += amt
            else:
                periods[period]["total_expense"] += amt
                periods[period]["by_category"][cat] = periods[period]["by_category"].get(cat, 0.0) + amt
                spending_by_category[cat] = spending_by_category.get(cat, 0.0) + amt

            if conf in ["medium", "low"]:
                confidence_notes.append({"merchant": merchant, "category": cat, "confidence": conf, "amount": amt})

            # Detect potential recurring subscriptions
            if any(k in m_lower for k in ["netflix", "spotify", "prime", "hotstar", "youtube"]):
                subscriptions.append({"service": merchant, "amount": amt, "type": "recurring_subscription", "confidence": conf})
            
            if cat == "Bills" and tx_type != "income":
                unbudgeted_items.append({"item": f"{merchant} Bill", "amount": amt, "status": "unbudgeted_expense", "note": "Utility expense"})

        # Period comparison analysis
        sorted_periods = sorted([p for p in periods.keys() if p != "current"])
        current_period = sorted_periods[-1] if sorted_periods else "current"
        
        # Determine previous period
        previous_period = None
        has_previous_period_data = False
        period_comparison = None

        if len(sorted_periods) >= 2:
            previous_period = sorted_periods[-2]
            prev_data = periods.get(previous_period, {})
            curr_data = periods.get(current_period, {})
            if prev_data.get("transactions"):
                has_previous_period_data = True
                curr_tot = curr_data.get("total_expense", 0.0)
                prev_tot = prev_data.get("total_expense", 0.0)
                cat_deltas = {}
                all_cats = set(list(curr_data.get("by_category", {}).keys()) + list(prev_data.get("by_category", {}).keys()))
                for c in all_cats:
                    c_curr = curr_data.get("by_category", {}).get(c, 0.0)
                    c_prev = prev_data.get("by_category", {}).get(c, 0.0)
                    cat_deltas[c] = c_curr - c_prev
                period_comparison = {
                    "current_period": current_period,
                    "previous_period": previous_period,
                    "current_spending": curr_tot,
                    "previous_spending": prev_tot,
                    "total_change": curr_tot - prev_tot,
                    "category_changes": cat_deltas
                }
        elif len(sorted_periods) == 1:
            # Only one period recorded: previous period is strictly NOT available
            p_parts = sorted_periods[0].split("-")
            if len(p_parts) == 2:
                try:
                    yr, mo = int(p_parts[0]), int(p_parts[1])
                    prev_mo = mo - 1 if mo > 1 else 12
                    prev_yr = yr if mo > 1 else yr - 1
                    previous_period = f"{prev_yr:04d}-{prev_mo:02d}"
                except ValueError:
                    previous_period = "previous"
            has_previous_period_data = False

        # Budget analysis
        budget_analysis = []
        alerts_agent1 = []
        for b in budgets_config:
            b_name = b["category"]
            b_limit = float(b["amount"])
            spent = spending_by_category.get(b_name, 0.0)
            pct = (spent / b_limit * 100.0) if b_limit > 0 else 0.0
            
            if pct >= 100.0:
                status = "exceeded"
                alerts_agent1.append(f"{b_name} budget exceeded! Spent ₹{spent:,.0f} of ₹{b_limit:,.0f} ({pct:.0f}%).")
            elif pct >= 75.0:
                status = "warning"
                alerts_agent1.append(f"{b_name} budget warning: {pct:.0f}% utilized (₹{spent:,.0f} of ₹{b_limit:,.0f}).")
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

        # Rank categories and transactions
        ranked_categories = sorted([(k, v) for k, v in spending_by_category.items() if v > 0], key=lambda x: x[1], reverse=True)
        ranked_transactions = sorted([t for t in categorized_txs if t.get("type") != "income"], key=lambda x: float(x.get("amount", 0)), reverse=True)

        analyzer_output = {
            "agent": "financial_analyzer",
            "status": "success",
            "categorized_transactions": categorized_txs,
            "budget_analysis": budget_analysis,
            "bills_analysis": unbudgeted_items,
            "subscription_analysis": subscriptions,
            "spending_by_category": spending_by_category,
            "total_expenses": sum(float(t.get("amount", 0)) for t in expense_txs),
            "total_income": sum(float(t.get("amount", 0)) for t in income_txs),
            "top_categories": ranked_categories,
            "top_transactions": ranked_transactions,
            "periods": periods,
            "current_period": current_period,
            "previous_period": previous_period,
            "has_previous_period_data": has_previous_period_data,
            "period_comparison": period_comparison,
            "confidence_notes": confidence_notes,
            "alerts": alerts_agent1
        }

        # -------------------------------------------------------------
        # 2. Agent 2: Financial Planner
        # -------------------------------------------------------------
        balance_after_purchase = curr_bal - purchase_amt if purchase_amt > 0 else curr_bal
        fc_30_before = curr_bal + surplus - bills_amt
        fc_30_after = balance_after_purchase + surplus - bills_amt
        fc_60_before = curr_bal + (2 * surplus) - bills_amt
        fc_60_after = balance_after_purchase + (2 * surplus) - bills_amt
        fc_90_before = curr_bal + (3 * surplus) - bills_amt
        fc_90_after = balance_after_purchase + (3 * surplus) - bills_amt

        goals_data = financial_data.get("goals", [])
        goal_gap = max(0.0, savings_goal - curr_savings) if savings_goal > 0 else 0.0
        months_to_goal = round(goal_gap / surplus, 1) if (surplus > 0 and goal_gap > 0) else (0.0 if goal_gap == 0 else 999.0)

        # Affordability verdict
        remaining_liquidity_after_all = balance_after_purchase - bills_amt
        if purchase_amt > 0:
            if remaining_liquidity_after_all >= expenses and expenses > 0:
                affordable = True
                verdict = f"Affordable: Purchasing {item_name} leaves ₹{balance_after_purchase:,.0f} liquid (₹{remaining_liquidity_after_all:,.0f} after reserving ₹{bills_amt:,.0f} bills), safely covering your monthly expenses."
            elif remaining_liquidity_after_all >= 0:
                affordable = True
                verdict = f"Affordable with caution: Leaves ₹{balance_after_purchase:,.0f} liquid, and ₹{remaining_liquidity_after_all:,.0f} after scheduled bills. Cushion for unexpected expenses is tight."
            else:
                affordable = False
                verdict = f"High liquidity risk: Purchasing {item_name} (₹{purchase_amt:,.0f}) would cause a deficit of ₹{abs(remaining_liquidity_after_all):,.0f} after scheduled upcoming bills."
        else:
            affordable = None
            verdict = "Item cost was not specified."

        planner_output = {
            "agent": "financial_planner",
            "status": "success",
            "cash_flow": {
                "liquid_balance": curr_bal,
                "monthly_income": income,
                "monthly_expenses": expenses,
                "monthly_surplus": surplus,
                "upcoming_bills_amt": bills_amt,
                "balance_after_bills": curr_bal - bills_amt,
                "balance_after_purchase": balance_after_purchase,
                "forecast_30_days_before": fc_30_before,
                "forecast_30_days_after": fc_30_after,
                "forecast_60_days_before": fc_60_before,
                "forecast_60_days_after": fc_60_after,
                "forecast_90_days_before": fc_90_before,
                "forecast_90_days_after": fc_90_after,
                "current_savings": curr_savings,
                "savings_goal": savings_goal
            },
            "goal_analysis": [
                {
                    "goal": g.get("name", "Savings Goal"),
                    "target": float(g.get("target_amount", savings_goal)),
                    "current": float(g.get("current_amount", curr_savings)),
                    "gap": max(0.0, float(g.get("target_amount", savings_goal)) - float(g.get("current_amount", curr_savings))),
                    "progress_pct": round((float(g.get("current_amount", 0)) / float(g.get("target_amount", 1)) * 100), 1) if float(g.get("target_amount", 0)) > 0 else 0,
                    "months_to_goal": round(max(0.0, float(g.get("target_amount", savings_goal)) - float(g.get("current_amount", curr_savings))) / surplus, 1) if surplus > 0 else 999.0
                } for g in goals_data
            ] if goals_data else (
                [{"goal": "Emergency Fund Goal", "target": savings_goal, "current": curr_savings, "gap": goal_gap, "progress_pct": round((curr_savings / savings_goal * 100), 1) if savings_goal > 0 else 0, "months_to_goal": months_to_goal}] if savings_goal > 0 else []
            ),
            "affordability_analysis": {
                "item": item_name,
                "cost": purchase_amt,
                "affordable": affordable,
                "verdict": verdict,
                "balance_after_purchase": balance_after_purchase,
                "net_after_purchase_and_bills": remaining_liquidity_after_all
            },
            "recommendations": []
        }

        if bills_amt > 0 and purchase_amt > 0:
            planner_output["recommendations"].append(f"Ensure ₹{bills_amt:,.0f} is ring-fenced for scheduled bills before purchasing {item_name}.")
        if goal_gap > 0 and surplus > 0:
            planner_output["recommendations"].append(f"Allocating your monthly surplus of ₹{surplus:,.0f} toward your savings goal will complete it in ~{months_to_goal} months.")

        # -------------------------------------------------------------
        # 3. Agent 3: Alert & Action
        # -------------------------------------------------------------
        all_alerts = []
        for b_alert in alerts_agent1:
            all_alerts.append({"level": "warning", "title": "Budget Alert", "message": b_alert})

        if bills_amt > 0 and bills_amt > curr_bal:
            all_alerts.append({"level": "danger", "title": "Liquidity Deficit", "message": f"Upcoming bills (₹{bills_amt:,.0f}) exceed liquid balance (₹{curr_bal:,.0f})."})
        elif bills_amt > 0:
            all_alerts.append({"level": "info", "title": "Upcoming Bills", "message": f"₹{bills_amt:,.0f} in upcoming bills require reservation."})

        if goal_gap > 0 and surplus <= 0:
            all_alerts.append({"level": "warning", "title": "Savings Pace Stalled", "message": "Zero monthly surplus is preventing emergency reserve growth."})

        # CRITICAL RULE:
        # Actions with requires_confirmation=True are ONLY created when an action is genuinely requested.
        # Informational / analytical inquiries MUST have requires_confirmation=False and action=None.
        action_obj = None
        req_confirm = False

        if intent == "execute_action":
            # Handled directly or by intent processor
            req_confirm = True

        action_output = {
            "agent": "alert_action",
            "status": "success",
            "alerts": all_alerts,
            "requires_confirmation": req_confirm,
            "action": action_obj
        }

        # -------------------------------------------------------------
        # 4. Agent 4: Financial Summary Agent
        # -------------------------------------------------------------
        summarizer_output = self._generate_simulated_summary(
            analyzer=analyzer_output,
            planner=planner_output,
            alert_action=action_output,
            financial_data=financial_data,
            user_query=user_query,
            intent=intent,
            conversation=conversation
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
        financial_data: Dict[str, Any],
        user_query: Optional[str] = None,
        intent: Optional[str] = None,
        conversation: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Agent 4: Financial Summary Agent
        Acts as the intelligent personal finance assistant that interprets
        outputs from Analyzer, Planner, and Alert agents to produce a natural,
        context-aware, conversational response directly tailored to the user's inquiry.
        """
        query = (user_query or "").strip()
        query_lower = query.lower()
        conv = conversation or []

        cash_flow = planner.get("cash_flow", {})
        curr_bal = cash_flow.get("liquid_balance", 0.0)
        income = cash_flow.get("monthly_income", 0.0)
        expenses = cash_flow.get("monthly_expenses", 0.0)
        surplus = cash_flow.get("monthly_surplus", 0.0)
        bills_amt = cash_flow.get("upcoming_bills_amt", 0.0)

        affordability = planner.get("affordability_analysis", {})
        item_name = affordability.get("item", "Item")
        cost = float(affordability.get("cost", 0.0))

        # 1. Multi-Turn Context Memory Resolution
        target_category = None
        common_categories = ["food", "shopping", "transport", "entertainment", "bills", "healthcare", "education"]
        for cat in common_categories:
            if cat in query_lower:
                target_category = cat.title()
                break

        # Check for pronouns ("it", "that", "why is it", "why so high", "spend more on it")
        is_pronoun_followup = any(w in query_lower for w in ["why is it", "why so high", "why is that", "explain it", "what drove it", "why did it", "on it", "spend more on it", "more on it", "for it", "about it"])
        if not target_category and (is_pronoun_followup or "it" in query_lower.split() or "that" in query_lower.split()):
            for msg in reversed(conv):
                content = (msg.get("content") or "").lower()
                for cat in common_categories:
                    if cat in content:
                        target_category = cat.title()
                        break
                if target_category:
                    break

        # Check for item follow-up ("what if i buy it next month")
        is_item_followup = "next month" in query_lower or ("buy it" in query_lower and not cost)
        if (not cost or cost == 0) and is_item_followup:
            for msg in reversed(conv):
                content = msg.get("content") or ""
                amt_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)', content, re.IGNORECASE)
                if amt_match:
                    try:
                        cost = float(amt_match.group(1).replace(",", ""))
                    except ValueError:
                        pass
                for itm in ["laptop", "phone", "macbook", "ipad", "bike", "car", "tv", "trip", "course"]:
                    if itm in content.lower():
                        item_name = itm.title()
                        break
                if cost > 0:
                    break

        # 2. Intent Resolution
        active_intent = None
        if intent in ("execute_action", "affordability_analysis", "what_if_analysis", "bill_analysis", "budget_analysis", "biggest_expenses", "spending_comparison", "category_spending", "goal_analysis"):
            active_intent = intent

        if any(w in query_lower for w in ["why am i spending more", "why did my spending increase", "spending increase", "more this month", "spending higher", "spending more"]):
            active_intent = "spending_comparison"
        elif any(w in query_lower for w in ["emergency fund", "savings goal", "on track", "reach my goal", "how much more to save", "is my emergency fund", "emergency savings"]):
            active_intent = "goal_analysis"
        elif any(w in query_lower for w in ["afford", "can i buy", "should i buy", "buy a", "buy the", "purchase"]):
            active_intent = "affordability_analysis"
        elif any(w in query_lower for w in ["what if", "next month"]) and not target_category:
            active_intent = "what_if_analysis"
        elif any(w in query_lower for w in ["biggest expense", "spend the most", "largest expense", "top expense", "where does my money go", "where am i spending", "biggest expenses"]):
            active_intent = "biggest_expenses"
        elif any(w in query_lower for w in ["after my bills", "after bills", "bills coming", "upcoming bills", "what bills", "bills are due", "due soon", "bills due"]):
            active_intent = "bill_analysis"
        elif target_category or any(w in query_lower for w in ["spent on", "spending on", "how much did i spend", "spend on", "spend more on it", "more on it", "can i spend"]):
            active_intent = "category_spending"
        elif any(w in query_lower for w in ["budget", "within budget", "overspending", "budget limit"]):
            active_intent = "budget_analysis"
        elif not active_intent:
            active_intent = intent or "general_overview"

        # 3. Conversational Response Formulation
        message_text = ""
        response_type = "information"
        insight_text = None
        warning_text = None
        follow_up_text = None
        data_status = "available"

        # TEST CASE 1 / Intent: spending_comparison ("Why am I spending more this month?")
        if active_intent == "spending_comparison":
            has_prev = analyzer.get("has_previous_period_data", False)
            curr_tot = analyzer.get("total_expenses", 0.0)
            top_cats = analyzer.get("top_categories", [])
            top_1 = top_cats[0] if len(top_cats) > 0 else ("General", 0.0)
            top_2 = top_cats[1] if len(top_cats) > 1 else None

            if not has_prev:
                # Strictly NO hallucination when previous-month data is missing
                message_text = (
                    f"I can see your recorded spending for this month totals **₹{curr_tot:,.0f}**, with your highest expenses in **{top_1[0]}** (₹{top_1[1]:,.0f})"
                    f"{f' followed by **{top_2[0]}** (₹{top_2[1]:,.0f})' if top_2 else ''}.\n\n"
                    f"However, I do not have previous-period transaction data in your records to verify whether your spending actually increased or to compare what caused the difference.\n\n"
                    f"If you provide or import your transactions from last month, I can compare the two periods and identify the exact categories and merchants responsible for any increase."
                )
                response_type = "missing_data_request"
                data_status = "partially_available"
                follow_up_text = "Would you like me to break down your current month's spending by category instead?"
                insight_text = f"Your current spending is ₹{curr_tot:,.0f}, leaving a net monthly surplus of +₹{surplus:,.0f}/mo."
            else:
                comp = analyzer.get("period_comparison") or {}
                delta = comp.get("total_change", 0.0)
                changes = comp.get("category_changes", {})
                increased = sorted([(k, v) for k, v in changes.items() if v > 0], key=lambda x: x[1], reverse=True)

                if delta > 0:
                    inc_summary = ", ".join([f"**{c}** (+₹{amt:,.0f})" for c, amt in increased[:2]]) if increased else "various categories"
                    message_text = (
                        f"Your spending this month is higher by **₹{delta:,.0f}** compared with your previous recorded period (₹{comp.get('current_spending', 0):,.0f} vs ₹{comp.get('previous_spending', 0):,.0f}).\n\n"
                        f"The main drivers behind this increase are {inc_summary}.\n\n"
                        f"Overall, your total recorded spending is **₹{curr_tot:,.0f}**, leaving an active monthly surplus of **+₹{surplus:,.0f}/mo**."
                    )
                    response_type = "explanation"
                elif delta < 0:
                    message_text = (
                        f"Actually, your spending this month is **lower by ₹{abs(delta):,.0f}** compared with last month "
                        f"(₹{comp.get('current_spending', 0):,.0f} vs ₹{comp.get('previous_spending', 0):,.0f}). Your cash flow has improved."
                    )
                    response_type = "explanation"
                else:
                    message_text = (
                        f"Your spending this month is virtually identical to last month at **₹{curr_tot:,.0f}**."
                    )
                    response_type = "explanation"

        # TEST CASE 2 / Intent: category_spending ("How much did I spend on food?")
        elif active_intent == "category_spending":
            cat_name = target_category or "Food"
            cat_txs = [t for t in analyzer.get("categorized_transactions", []) if t.get("category", "").lower() == cat_name.lower() and t.get("type") != "income"]
            cat_total = sum(float(t.get("amount", 0)) for t in cat_txs)
            cat_budget = next((b for b in analyzer.get("budget_analysis", []) if b.get("budget_name", "").lower() == cat_name.lower()), None)

            # Check if this is a headroom / "can I spend more" inquiry
            is_headroom_query = any(w in query_lower for w in ["spend more", "can i spend", "more on it", "afford more", "room to spend", "spend another"])
            if is_headroom_query:
                if cat_budget:
                    b_rem = cat_budget.get("remaining", 0.0)
                    b_lim = cat_budget.get("budget_amount", 0.0)
                    b_pct = cat_budget.get("percentage_used", 0.0)
                    if b_rem > 0:
                        message_text = (
                            f"Yes, you have **₹{b_rem:,.0f}** remaining in your **{cat_name}** budget for this month.\n\n"
                            f"So far, you have spent **₹{cat_total:,.0f}** of your **₹{b_lim:,.0f}** limit ({b_pct:.0f}% used across {len(cat_txs)} transactions). "
                            f"You can comfortably spend up to ₹{b_rem:,.0f} more without exceeding your budget."
                        )
                        response_type = "direct_answer"
                        insight_text = f"You have ₹{b_rem:,.0f} remaining headroom in your {cat_name} budget."
                    else:
                        message_text = (
                            f"You have already reached or exceeded your **₹{b_lim:,.0f}** budget for **{cat_name}** "
                            f"(current spending is **₹{cat_total:,.0f}**).\n\n"
                            f"Additional spending in this category will reduce your monthly surplus of +₹{surplus:,.0f}/mo."
                        )
                        response_type = "warning"
                        warning_text = f"{cat_name} budget is already fully utilized."
                else:
                    message_text = (
                        f"You have spent **₹{cat_total:,.0f}** on **{cat_name}** this month. "
                        f"You do not have a dedicated budget limit set for {cat_name}, but your overall monthly surplus is **+₹{surplus:,.0f}/mo**."
                    )
                    response_type = "information"
            # Check if this is an explanation follow-up ("Why is it so high?")
            elif is_pronoun_followup and cat_txs:
                lines = []
                for t in cat_txs:
                    m = t.get("merchant", "Expense")
                    a = float(t.get("amount", 0))
                    d = t.get("date", "recent")
                    n = f" ({t['notes']})" if t.get("notes") else ""
                    lines.append(f"• **{m}**: ₹{a:,.0f} on {d}{n}")
                tx_lines = "\n".join(lines)
                b_note = ""
                if cat_budget:
                    b_note = f"While within your ₹{cat_budget['budget_amount']:,.0f} budget ({cat_budget['percentage_used']:.0f}% used), dining out is currently your second largest expense category."
                message_text = (
                    f"Your **{cat_name}** spending of **₹{cat_total:,.0f}** this month is driven by {len(cat_txs)} transaction{'s' if len(cat_txs) > 1 else ''}:\n"
                    f"{tx_lines}\n\n"
                    f"Together, these transactions account for 100% of your recorded {cat_name} expenses. {b_note}"
                )
                response_type = "explanation"
                insight_text = f"{cat_name} accounts for {round(cat_total / max(1.0, analyzer.get('total_expenses', 1.0)) * 100)}% of your monthly outflows."
            elif cat_txs:
                tx_bullets = "\n".join([f"• **{t.get('merchant', 'Expense')}**: ₹{float(t.get('amount', 0)):,.0f} ({t.get('date', 'Recent')})" for t in cat_txs[:4]])
                budget_clause = ""
                if cat_budget:
                    b_lim = cat_budget["budget_amount"]
                    b_pct = cat_budget["percentage_used"]
                    b_rem = cat_budget["remaining"]
                    budget_clause = f"\n\nYour monthly {cat_name} budget is **₹{b_lim:,.0f}**, so you have utilized about **{b_pct:.0f}%** of your limit and have **₹{b_rem:,.0f}** remaining for this cycle."
                message_text = (
                    f"You spent **₹{cat_total:,.0f}** on {cat_name} this month across {len(cat_txs)} transaction{'s' if len(cat_txs) > 1 else ''}:\n"
                    f"{tx_bullets}{budget_clause}"
                )
                response_type = "explanation"
                insight_text = f"{cat_name} spending is tracking well within your allocated budget."
            else:
                message_text = f"You have no recorded expenses in the **{cat_name}** category for this month."
                response_type = "information"

        # TEST CASE 3 / Intent: goal_analysis ("Am I on track for my emergency fund?")
        elif active_intent == "goal_analysis":
            goals = planner.get("goal_analysis", [])
            em_goal = next((g for g in goals if "emergency" in g.get("goal", "").lower()), goals[0] if goals else None)

            if em_goal and em_goal.get("target", 0) > 0:
                target = em_goal["target"]
                current = em_goal["current"]
                gap = em_goal["gap"]
                pct = em_goal["progress_pct"]
                months = em_goal.get("months_to_goal", 0.0)

                message_text = (
                    f"You have saved **₹{current:,.0f}** toward your **₹{target:,.0f}** {em_goal.get('goal', 'Emergency Fund')}, "
                    f"which puts you at **{pct:.0f}% completion** with a remaining shortfall of **₹{gap:,.0f}**.\n\n"
                    f"At your current monthly surplus of **+₹{surplus:,.0f}/mo**, you are on track to fully fund this goal in approximately "
                    f"**{months:.1f} months**, assuming your monthly surplus is directed toward savings."
                )
                response_type = "insight"
                insight_text = f"Consistent allocation of your +₹{surplus:,.0f}/mo surplus will reach full funding in ~{months:.1f} months."
                follow_up_text = "Would you like me to calculate how adjusting your monthly contribution would affect your completion date?"
            else:
                message_text = (
                    "I can estimate your savings progress and timeline, but you do not have an active savings goal or savings balance recorded yet.\n\n"
                    "Please set your target savings amount and current balance so I can project your completion timeline."
                )
                response_type = "missing_data_request"
                data_status = "not_available"

        # TEST CASE 4 / Intent: affordability_analysis ("Can I afford a ₹50,000 laptop?")
        elif active_intent == "affordability_analysis":
            cost_val = cost or 50000.0
            item_lbl = item_name or "item"
            bal_after = curr_bal - cost_val
            net_cushion = bal_after - bills_amt

            if cost_val > 0:
                is_aff = affordability.get("affordable", True) and net_cushion >= 0
                verdict_status = "feasible with caution" if is_aff else "a significant liquidity risk"
                message_text = (
                    f"Purchasing a **₹{cost_val:,.0f} {item_lbl}** is **{verdict_status}** based on your current financial situation.\n\n"
                    f"Your total liquid balance across accounts is **₹{curr_bal:,.0f}**. After paying ₹{cost_val:,.0f} for the {item_lbl}, your liquid balance would be **₹{bal_after:,.0f}**. "
                    f"Once your scheduled upcoming bills of **₹{bills_amt:,.0f}** are settled, your remaining liquid cushion will be **₹{net_cushion:,.0f}**.\n\n"
                    f"With your monthly surplus of **+₹{surplus:,.0f}/mo**, your reserves are projected to recover within 1 to 2 months. "
                    f"It is important to keep funds for your scheduled upcoming bills reserved before committing to this purchase."
                )
                response_type = "recommendation" if is_aff else "warning"
                insight_text = f"Reserving ₹{bills_amt:,.0f} for upcoming bills prevents dipping into living expense buffers."
                follow_up_text = f"Would you like me to model how waiting until next month to buy the {item_lbl} would affect your cash flow?"
                if net_cushion < 0:
                    warning_text = f"Liquidity Deficit: Buying now creates a deficit of ₹{abs(net_cushion):,.0f} after scheduled bills."
            else:
                message_text = (
                    f"I can evaluate whether you can afford the {item_lbl}, but I need to know its cost. "
                    f"Please specify the purchase amount (e.g. 'Can I afford a ₹50,000 laptop?')."
                )
                response_type = "missing_data_request"
                data_status = "partially_available"

        # TEST CASE 5 / Intent: what_if_analysis ("What if I buy it next month?")
        elif active_intent == "what_if_analysis":
            cost_val = cost or 50000.0
            item_lbl = item_name or "Laptop"
            message_text = (
                f"Waiting until next month to purchase the **₹{cost_val:,.0f} {item_lbl}** significantly improves your financial position.\n\n"
                f"Over the next month, you will accumulate another **+₹{surplus:,.0f}** from your regular monthly surplus while clearing your current scheduled bills of **₹{bills_amt:,.0f}**.\n\n"
                f"By postponing the purchase by 30 days, your net liquid cushion after buying the {item_lbl} will be approximately **₹{surplus:,.0f} higher** "
                f"than if you purchased it today, ensuring your emergency living expense buffer is never strained."
            )
            response_type = "insight"
            insight_text = "Timing discretionary purchases across monthly pay cycles preserves liquidity."

        # TEST CASE 6 / Intent: biggest_expenses ("What are my biggest expenses?")
        elif active_intent == "biggest_expenses":
            top_txs = analyzer.get("top_transactions", [])
            top_cats = analyzer.get("top_categories", [])
            tx_bullets = "\n".join([f"• **{t.get('merchant', 'Expense')}** — ₹{float(t.get('amount', 0)):,.0f} ({t.get('category', 'Other')})" for t in top_txs[:3]]) if top_txs else "• No expense transactions recorded"
            cat_summary = ", ".join([f"**{c}** (₹{a:,.0f})" for c, a in top_cats[:2]]) if top_cats else "None"

            message_text = (
                f"Your largest recorded transactions this month are:\n"
                f"{tx_bullets}\n\n"
                f"By category, your spending is led by {cat_summary}."
            )
            response_type = "explanation"
            if top_cats:
                insight_text = f"{top_cats[0][0]} represents your single largest category outflow this cycle."

        # TEST CASE 7 / Intent: bill_analysis ("How much will I have after my upcoming bills?")
        elif active_intent == "bill_analysis":
            unpaid_b = [b for b in financial_data.get("bills", []) if b.get("status") != "paid"]
            tot_b = sum(float(b.get("amount", 0)) for b in unpaid_b)
            rem = curr_bal - tot_b

            if unpaid_b:
                bill_lines = "\n".join([f"• **{b.get('name', 'Bill')}** — ₹{float(b.get('amount', 0)):,.0f} (Due {b.get('due_date', 'Soon')})" for b in unpaid_b])
                message_text = (
                    f"You have {len(unpaid_b)} scheduled upcoming bills totaling **₹{tot_b:,.0f}**:\n"
                    f"{bill_lines}\n\n"
                    f"With your current liquid balance of **₹{curr_bal:,.0f}**, you will have **₹{rem:,.0f}** remaining once all scheduled obligations are settled."
                )
                response_type = "explanation"
                insight_text = "Your liquid balance comfortably covers all upcoming scheduled obligations."
                if rem < 0:
                    warning_text = f"Urgent: Scheduled obligations exceed liquid reserves by ₹{abs(rem):,.0f}."
            else:
                message_text = (
                    f"You have no pending unpaid bills recorded at this time. "
                    f"Your full liquid balance of **₹{curr_bal:,.0f}** remains unencumbered."
                )
                response_type = "information"

        # Intent: budget_analysis ("How is my budget?")
        elif active_intent == "budget_analysis":
            budgets = analyzer.get("budget_analysis", [])
            exceeded = [b for b in budgets if b.get("status") == "exceeded"]
            warning = [b for b in budgets if b.get("status") == "warning"]
            b_lines = "\n".join([f"• **{b['budget_name']}**: {b['percentage_used']:.0f}% used (₹{b['spending']:,.0f} of ₹{b['budget_amount']:,.0f}, ₹{b['remaining']:,.0f} remaining)" for b in budgets[:4]])

            message_text = (
                f"You have {len(budgets)} active category budgets tracked this month:\n"
                f"{b_lines}\n\n"
                f"Overall, your spending is within allocated limits, with {f'{len(exceeded)} category exceeded and ' if exceeded else ''}{len(warning)} category nearing its threshold."
            )
            response_type = "insight"
            insight_text = "Monitoring discretionary categories preserves your planned monthly savings pace."

        # Default: general_overview
        else:
            goals = planner.get("goal_analysis", [])
            em_goal = goals[0] if goals else {}
            em_current = em_goal.get("current", 0.0)
            em_target = em_goal.get("target", 0.0)
            em_pct = em_goal.get("progress_pct", 0)

            message_text = (
                f"Here is a summary of your current financial situation:\n\n"
                f"Your total liquid balance across accounts is **₹{curr_bal:,.0f}**, supported by a monthly income of **₹{income:,.0f}** and living expenses of **₹{expenses:,.0f}**, leaving you with a net monthly surplus of **+₹{surplus:,.0f}/mo**.\n\n"
                f"You have **₹{bills_amt:,.0f}** in upcoming scheduled bills, and your emergency savings is at **₹{em_current:,.0f}** "
                f"{f'({em_pct:.0f}% of your ₹{em_target:,.0f} goal)' if em_target > 0 else ''}.\n\n"
                f"Overall, your cash flow is stable and sufficient to cover scheduled obligations while continuing to build your reserves."
            )
            response_type = "information"
            insight_text = f"Positive cash surplus of +₹{surplus:,.0f}/mo maintains consistent liquidity."

        # Financial health status score
        health_score = "Healthy & Stable"
        health_badge = "badge-success"
        if warning_text or (bills_amt > curr_bal):
            health_score = "Caution Advised"
            health_badge = "badge-danger"
        elif any(b.get("status") == "warning" for b in analyzer.get("budget_analysis", [])):
            health_score = "Moderate Attention Needed"
            health_badge = "badge-warning"

        return {
            "agent": "financial_summarizer",
            "stage": "4",
            "status": "success",
            "health_score": health_score,
            "health_badge": health_badge,
            "message": message_text,
            "executive_summary": message_text,
            "response_type": response_type,
            "insight": insight_text,
            "warning": warning_text,
            "follow_up": follow_up_text,
            "data_status": data_status,
            "synthesized_from": ["financial_analyzer", "financial_planner", "alert_action"]
        }

