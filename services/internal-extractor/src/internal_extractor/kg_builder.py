from neo4j_graphrag.experimental.components.entity_relation_extractor import (
    LLMEntityRelationExtractor,
    OnError,
)

from .document_text import extract_text
from .graph_mapper import map_graph
from .models import ExtractionRequest, ExtractionResultsResponse
from .providers import create_llm
from .pydantic_loader import (
    LoadedOntologyModels,
    load_pydantic_extraction_models,
    validate_and_repair_entities,
)
from .schema_mapper import to_graph_schema
from .text_sections import split_document_text, split_text

__all__ = [
    "map_graph",
    "run_extraction",
    "split_document_text",
    "split_text",
    "to_graph_schema",
]


async def run_extraction(request: ExtractionRequest) -> ExtractionResultsResponse:
    loaded_models: LoadedOntologyModels | None = None
    if request.pydantic_code:
        loaded_models = load_pydantic_extraction_models(
            request.pydantic_code, request.extraction_schema
        )

    text = extract_text(request.file)
    sectioned_text = split_document_text(text)
    if not sectioned_text.chunks.chunks:
        return ExtractionResultsResponse(sections=[], entities=[], facts=[])

    llm = create_llm(request.provider, request.modelName, request.apiKey)
    try:
        extractor = LLMEntityRelationExtractor(
            llm=llm,
            create_lexical_graph=True,
            on_error=OnError.IGNORE,
            use_structured_output=request.provider == "openai",
        )
        graph = await extractor.run(
            chunks=sectioned_text.chunks,
            schema=to_graph_schema(request),
        )
        mapped = map_graph(graph, sectioned_text.chunks, sectioned_text.sections)
        if loaded_models is not None:
            return validate_and_repair_entities(loaded_models, mapped)
        return mapped
    finally:
        close = getattr(llm, "aclose", None)
        if close is not None:
            await close()
