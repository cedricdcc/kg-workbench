import logging
from typing import Any
import pyshacl

logger = logging.getLogger("reasoner.shacl_engine")


def validate_shacl_turtle(
    data_graph_ttl: str,
    shapes_graph_ttl: str,
    inference: str = "rdfs",
) -> dict[str, Any]:
    """Validates an RDF data graph against a SHACL shapes graph in Turtle format."""
    try:
        conforms, results_graph, results_text = pyshacl.validate(
            data_graph_ttl,
            shacl_graph=shapes_graph_ttl,
            data_graph_format="turtle",
            shacl_graph_format="turtle",
            inference=inference,
            debug=False,
        )

        return {
            "conforms": bool(conforms),
            "reportText": str(results_text),
            "resultsCount": len(results_graph) if results_graph else 0,
        }
    except Exception as exc:
        logger.exception("Error running pySHACL validation: %s", exc)
        return {
            "conforms": False,
            "reportText": f"Validation execution error: {exc}",
            "resultsCount": 1,
            "error": str(exc),
        }

