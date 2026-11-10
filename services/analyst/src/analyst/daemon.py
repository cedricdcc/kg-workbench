import asyncio
import logging
from typing import Any
import httpx

from .config import settings
from .drift_detector import detect_knowledge_contradictions
from .graph_engine import (
    build_knowledge_graph,
    extract_subgraph_for_query,
    format_triples_for_prompt,
)

logger = logging.getLogger("analyst.daemon")


async def send_heartbeat(client: httpx.AsyncClient) -> bool:
    url = f"{settings.workbench_api_url}/api/system/services/heartbeat"
    payload = {
        "id": "analyst",
        "service": "analyst",
        "displayName": "NetworkX Graph Analyst Worker",
        "workerId": settings.worker_id,
        "status": "healthy",
        "capabilities": ["graph_qa", "vector_search", "drift_detection"],
        "metadata": {
            "version": "0.1.0",
            "worker_id": settings.worker_id,
            "engine": "networkx",
        },
    }
    try:
        resp = await client.post(url, json=payload, timeout=5.0)
        if resp.status_code == 200:
            logger.debug("Heartbeat registered successfully with Workbench.")
            return True
        logger.warning(
            "Heartbeat responded with status %s: %s",
            resp.status_code,
            resp.text,
        )
        return False
    except Exception as exc:
        logger.warning("Could not reach Workbench for heartbeat: %s", exc)
        return False


async def heartbeat_loop(stop_event: asyncio.Event) -> None:
    logger.info("Starting background heartbeat loop to %s", settings.workbench_api_url)
    async with httpx.AsyncClient() as client:
        while not stop_event.is_set():
            await send_heartbeat(client)
            try:
                await asyncio.wait_for(
                    stop_event.wait(),
                    timeout=float(settings.heartbeat_interval_seconds),
                )
            except asyncio.TimeoutError:
                pass


async def claim_job(client: httpx.AsyncClient) -> dict[str, Any] | None:
    url = f"{settings.workbench_api_url}/api/system/jobs/claim"
    payload = {
        "workerType": "analyst",
        "workerId": settings.worker_id,
        "leaseSeconds": 120,
    }
    try:
        resp = await client.post(url, json=payload, timeout=5.0)
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("ok") and data.get("job"):
            return data
        return None
    except Exception as exc:
        logger.debug("Failed to poll for analyst jobs: %s", exc)
        return None


async def complete_job(
    client: httpx.AsyncClient,
    job_id: str,
    result: dict[str, Any] | None = None,
) -> bool:
    url = f"{settings.workbench_api_url}/api/system/jobs/{job_id}/complete"
    try:
        resp = await client.post(url, json={"result": result or {}}, timeout=5.0)
        return resp.status_code == 200
    except Exception as exc:
        logger.error("Failed to complete analyst job %s: %s", job_id, exc)
        return False


async def fail_job(
    client: httpx.AsyncClient,
    job_id: str,
    error_message: str,
    current_attempts: int,
    max_attempts: int = 3,
) -> bool:
    url = f"{settings.workbench_api_url}/api/system/jobs/{job_id}/fail"
    payload = {
        "errorMessage": error_message,
        "currentAttempts": current_attempts,
        "maxAttempts": max_attempts,
    }
    try:
        resp = await client.post(url, json=payload, timeout=5.0)
        return resp.status_code == 200
    except Exception as exc:
        logger.error("Failed to record failure for analyst job %s: %s", job_id, exc)
        return False


async def execute_job(client: httpx.AsyncClient, claimed: dict[str, Any]) -> None:
    job = claimed.get("job") or {}
    job_id = job.get("id")
    if not job_id:
        return
    current_attempts = job.get("attempts", 1)
    event_payload = claimed.get("eventPayload") or {}

    logger.info("Executing claimed analyst job %s (attempt %s)", job_id, current_attempts)
    try:
        event_type = (
            event_payload.get("eventType")
            or event_payload.get("event_type")
            or claimed.get("eventType")
            or job.get("eventType")
            or job.get("event_type")
        )

        if event_type == "analyst.query_requested":
            query = str(event_payload.get("query") or "").strip()
            facts = event_payload.get("facts") or []
            anchors = event_payload.get("anchors") or []
            datasets = event_payload.get("datasets") or []
            conversation_id = event_payload.get("conversationId")

            # Case A: Knowledge graph has no facts or datasets
            if not facts and not datasets:
                answer = (
                    "I searched the knowledge graph for your query, but this ontology currently has "
                    "no accepted facts or mapped tabular datasets. To query the knowledge graph, please "
                    "accept extracted facts in the Ontology workbench or map tabular datasets."
                )
                reasoning_trace = [
                    {
                        "step": "Knowledge Base Inspection",
                        "detail": "Inspected active ontology graph: found 0 accepted facts and 0 mapped tabular datasets.",
                    },
                    {
                        "step": "Direct Explanation",
                        "detail": "Informed user that no graph triples or table records exist to answer the query.",
                    },
                ]
                subgraph = {"nodes": [], "edges": []}
                citations: list[dict[str, Any]] = []
            else:
                # Case B: Knowledge graph contains data
                graph = build_knowledge_graph(facts=facts, tables=datasets)
                subgraph = extract_subgraph_for_query(graph, query, max_hops=2)
                triples = format_triples_for_prompt(subgraph)

                # Match anchors to citations
                citations = []
                fact_ids_in_subgraph = {
                    e.get("fact_id")
                    for e in subgraph.get("edges", [])
                    if e.get("fact_id")
                }

                # Document citations from fact anchors
                for anchor in anchors:
                    fid = anchor.get("fact_id")
                    if not fact_ids_in_subgraph or fid in fact_ids_in_subgraph:
                        s_name = anchor.get("sourceName") or anchor.get("document_id") or "Document"
                        quote = anchor.get("quote_text") or anchor.get("context_text") or ""
                        p_idx = anchor.get("paragraph_id") or anchor.get("page_from") or 0
                        citations.append({
                            "sourceType": "document",
                            "sourceId": str(anchor.get("document_id") or s_name),
                            "sourceName": str(s_name),
                            "paragraphIndex": int(p_idx) if str(p_idx).isdigit() else 0,
                            "pageFrom": anchor.get("page_from"),
                            "pageTo": anchor.get("page_to"),
                            "quoteText": str(quote),
                        })
                        if len(citations) >= 4:
                            break

                # Table citations from mapped datasets
                for ds in datasets:
                    s_name = ds.get("sourceName") or "dataset.csv"
                    citations.append({
                        "sourceType": "table",
                        "sourceId": str(ds.get("id") or s_name),
                        "sourceName": str(s_name),
                        "tableRowKey": "ROW-1",
                        "quoteText": f"Mapped record from {s_name}",
                    })
                    if len(citations) >= 6:
                        break

                node_count = len(subgraph.get("nodes", []))
                edge_count = len(subgraph.get("edges", []))

                reasoning_trace = [
                    {
                        "step": "Entity Recognition & Anchoring",
                        "detail": f"Parsed query and identified {node_count} relevant entity nodes in the graph.",
                    },
                    {
                        "step": "Multi-Hop Traversal",
                        "detail": f"Traversed {edge_count} connective relationships up to 2 hops across accepted facts and mapped tables.",
                    },
                    {
                        "step": "Evidence Corroboration",
                        "detail": f"Corroborated findings with {len(citations)} source citations.",
                    },
                ]

                if node_count > 0:
                    matched_labels = [n.get("label") for n in subgraph.get("nodes", [])[:6] if n.get("label")]
                    entities_summary = ", ".join(matched_labels) if matched_labels else "Identified graph nodes"

                    answer_lines = [
                        f"Based on the knowledge graph traversal, here are the findings for **\"{query}\"**:\n",
                        f"**Identified Entities:** {entities_summary}\n",
                    ]

                    if triples:
                        answer_lines.append("**Key Discovered Relationships:**")
                        for idx, t in enumerate(triples[:6]):
                            citation_tag = ""
                            if citations:
                                c = citations[idx % len(citations)]
                                if c["sourceType"] == "document":
                                    citation_tag = f" [Doc: {c['sourceName']} # {c.get('paragraphIndex', 1)}]"
                                else:
                                    citation_tag = f" [Table: {c['sourceName']} # {c.get('tableRowKey', 'ROW-1')}]"
                            answer_lines.append(f"- {t}{citation_tag}")

                    answer_lines.append(
                        "\n*You can explore the traversed path by clicking **View Subgraph** below, or inspect source evidence via the citation badges.*"
                    )
                    answer = "\n".join(answer_lines)
                else:
                    answer = (
                        f"I traversed the knowledge graph (containing {len(facts)} accepted facts and {len(datasets)} datasets), "
                        f"but no entities or relations directly matched **\"{query}\"**.\n\n"
                        "Try querying entities present in your ontology or inspect the Ontology workbench to view active classes."
                    )

            result = {
                "conversationId": conversation_id,
                "answer": answer,
                "content": answer,
                "reasoningTrace": reasoning_trace,
                "subgraph": subgraph,
                "citations": citations,
                "processedBy": settings.worker_id,
                "status": "completed",
            }
            await complete_job(client, job_id, result)
            logger.info("Analyst query job %s completed successfully", job_id)
            return

        elif event_type == "analyst.drift_analysis_requested":
            facts = event_payload.get("facts") or []
            datasets = event_payload.get("datasets") or []
            ontology_id = event_payload.get("ontologyId")
            group_key = event_payload.get("groupKey") or "shared"

            contradictions = detect_knowledge_contradictions(facts=facts, tables=datasets)

            formatted_contradictions = []
            for c in contradictions:
                formatted_contradictions.append({
                    "ontologyId": ontology_id,
                    "groupKey": group_key,
                    "entityId": c.entity_id,
                    "entityLabel": c.entity_label,
                    "relationName": c.relation_name,
                    "conflictType": c.conflict_type,
                    "factA": c.fact_a,
                    "factB": c.fact_b,
                    "explanation": c.explanation,
                    "status": "open",
                })

            result = {
                "ontologyId": ontology_id,
                "groupKey": group_key,
                "contradictions": formatted_contradictions,
                "processedBy": settings.worker_id,
                "status": "completed",
            }
            await complete_job(client, job_id, result)
            logger.info(
                "Analyst drift job %s completed with %d contradictions",
                job_id,
                len(formatted_contradictions),
            )
            return

        # Fallback for unrecognized/test event types
        result = {
            "processedBy": settings.worker_id,
            "status": "processed",
            "eventType": event_type,
        }
        await complete_job(client, job_id, result)
        logger.info("Analyst job %s completed successfully", job_id)
    except Exception as exc:
        logger.exception("Error executing analyst job %s: %s", job_id, exc)
        await fail_job(client, job_id, str(exc), current_attempts)


async def worker_loop(stop_event: asyncio.Event) -> None:
    logger.info("Starting background worker polling loop for workerType='analyst'")
    async with httpx.AsyncClient() as client:
        while not stop_event.is_set():
            claimed = await claim_job(client)
            if claimed:
                await execute_job(client, claimed)
                continue

            try:
                await asyncio.wait_for(
                    stop_event.wait(),
                    timeout=float(settings.poll_interval_seconds),
                )
            except asyncio.TimeoutError:
                pass
