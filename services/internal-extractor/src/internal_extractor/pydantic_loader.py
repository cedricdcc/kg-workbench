from __future__ import annotations

import ast
import datetime
import decimal
import enum
import json
import logging
import re
import typing
import uuid
from dataclasses import dataclass, field
from typing import Annotated, Any

import pydantic
from pydantic import BaseModel, TypeAdapter, ValidationError

from .models import (
    ExtractionEntityAttribute,
    ExtractionEntityResult,
    ExtractionResultsResponse,
    ExtractionSchema,
)

logger = logging.getLogger(__name__)

ALLOWED_MODULES: frozenset[str] = frozenset(
    {
        "__future__",
        "pydantic",
        "typing",
        "datetime",
        "enum",
        "decimal",
        "uuid",
        "re",
    }
)

DANGEROUS_NAMES: frozenset[str] = frozenset(
    {
        "eval",
        "exec",
        "compile",
        "__import__",
        "open",
        "getattr",
        "setattr",
        "delattr",
        "globals",
        "locals",
        "vars",
        "dir",
        "breakpoint",
        "input",
        "__builtins__",
        "__loader__",
        "__spec__",
        "os",
        "sys",
        "subprocess",
        "shutil",
        "pathlib",
        "socket",
        "http",
        "urllib",
        "importlib",
    }
)

ALLOWED_CALL_NAMES: frozenset[str] = frozenset(
    {
        "Field",
        "ConfigDict",
        "PrivateAttr",
        "field_validator",
        "model_validator",
        "validator",
        "Annotated",
        "Literal",
        "Pattern",
        "Decimal",
        "UUID",
        "date",
        "datetime",
        "time",
        "timedelta",
        "Enum",
        "IntEnum",
        "StrEnum",
        "list",
        "dict",
        "set",
        "tuple",
        "str",
        "int",
        "float",
        "bool",
        "ValueError",
        "TypeError",
        "conint",
        "confloat",
        "constr",
        "conlist",
    }
)

ALLOWED_MODULE_ATTR_CALLS: frozenset[tuple[str, str]] = frozenset(
    {
        ("re", "compile"),
        ("pydantic", "Field"),
        ("pydantic", "ConfigDict"),
        ("pydantic", "PrivateAttr"),
        ("pydantic", "field_validator"),
        ("pydantic", "model_validator"),
        ("datetime", "date"),
        ("datetime", "datetime"),
        ("datetime", "time"),
        ("datetime", "timedelta"),
        ("decimal", "Decimal"),
        ("uuid", "UUID"),
        ("enum", "Enum"),
    }
)

ALLOWED_VALIDATOR_DECORATORS: frozenset[str] = frozenset(
    {"field_validator", "model_validator", "validator"}
)


class UnsafePydanticCodeError(ValueError):
    """Raised when generated Pydantic code fails AST safety validation."""


def _is_dunder(name: str) -> bool:
    return len(name) >= 4 and name.startswith("__") and name.endswith("__")


def _decorator_name(node: ast.expr) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Call):
        return _decorator_name(node.func)
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _is_model_rebuild_call(node: ast.expr) -> bool:
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "model_rebuild"
    )


def _validate_ast_subtree(node: ast.AST) -> None:
    for child in ast.walk(node):
        if isinstance(child, ast.Name):
            if child.id in DANGEROUS_NAMES:
                raise UnsafePydanticCodeError(
                    f"Disallowed identifier in Pydantic code: {child.id!r}"
                )
        elif isinstance(child, ast.Attribute):
            if _is_dunder(child.attr):
                raise UnsafePydanticCodeError(
                    f"Disallowed dunder attribute access: {child.attr!r}"
                )
        elif isinstance(child, ast.Call):
            func = child.func
            if isinstance(func, ast.Name):
                if func.id not in ALLOWED_CALL_NAMES:
                    raise UnsafePydanticCodeError(
                        f"Disallowed function call in Pydantic code: {func.id!r}"
                    )
            elif isinstance(func, ast.Attribute):
                if func.attr == "model_rebuild":
                    continue
                if (
                    isinstance(func.value, ast.Name)
                    and (func.value.id, func.attr) in ALLOWED_MODULE_ATTR_CALLS
                ):
                    continue
                raise UnsafePydanticCodeError(
                    f"Disallowed method call in Pydantic code: {ast.dump(func)}"
                )
            else:
                raise UnsafePydanticCodeError(
                    f"Disallowed dynamic call in Pydantic code: {ast.dump(func)}"
                )
        elif isinstance(child, (ast.Lambda, ast.Global, ast.Nonlocal, ast.Delete)):
            raise UnsafePydanticCodeError(
                f"Disallowed construct in Pydantic code: {type(child).__name__}"
            )


def _validate_class_body(class_node: ast.ClassDef) -> None:
    for dec in class_node.decorator_list:
        _validate_ast_subtree(dec)
    for base in class_node.bases:
        _validate_ast_subtree(base)
    for kw in class_node.keywords:
        _validate_ast_subtree(kw)

    for stmt in class_node.body:
        if isinstance(stmt, (ast.AnnAssign, ast.Assign, ast.Pass)):
            _validate_ast_subtree(stmt)
        elif isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant):
            continue
        elif isinstance(stmt, ast.FunctionDef):
            dec_names = {_decorator_name(d) for d in stmt.decorator_list}
            is_validator = bool(dec_names & ALLOWED_VALIDATOR_DECORATORS)
            is_stub = all(
                isinstance(s, ast.Pass)
                or (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant))
                for s in stmt.body
            )
            if not (is_validator or is_stub):
                raise UnsafePydanticCodeError(
                    f"Disallowed method {stmt.name!r} in class {class_node.name!r}"
                )
            _validate_ast_subtree(stmt)
        else:
            raise UnsafePydanticCodeError(
                f"Disallowed statement {type(stmt).__name__} in class {class_node.name!r}"
            )


def validate_pydantic_ast(code: str) -> ast.Module:
    """Parse and validate generated Pydantic v2 code against a strict AST whitelist."""
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as exc:
        raise UnsafePydanticCodeError(f"Invalid Python syntax: {exc}") from exc

    for stmt in tree.body:
        if isinstance(stmt, ast.Import):
            for alias in stmt.names:
                root_pkg = alias.name.split(".")[0]
                if root_pkg not in ALLOWED_MODULES:
                    raise UnsafePydanticCodeError(
                        f"Disallowed import module: {alias.name!r}"
                    )
        elif isinstance(stmt, ast.ImportFrom):
            if stmt.level != 0 or not stmt.module:
                raise UnsafePydanticCodeError("Relative imports are not allowed.")
            root_pkg = stmt.module.split(".")[0]
            if root_pkg not in ALLOWED_MODULES:
                raise UnsafePydanticCodeError(
                    f"Disallowed from-import module: {stmt.module!r}"
                )
        elif isinstance(stmt, ast.ClassDef):
            _validate_class_body(stmt)
        elif isinstance(stmt, (ast.AnnAssign, ast.Assign, ast.Pass)):
            _validate_ast_subtree(stmt)
        elif isinstance(stmt, ast.Expr):
            if isinstance(stmt.value, ast.Constant):
                continue
            if _is_model_rebuild_call(stmt.value):
                _validate_ast_subtree(stmt.value)
                continue
            raise UnsafePydanticCodeError(
                f"Disallowed top-level expression: {ast.dump(stmt.value)}"
            )
        else:
            raise UnsafePydanticCodeError(
                f"Disallowed top-level statement: {type(stmt).__name__}"
            )

    return tree


_PREIMPORTED_MODULES: dict[str, Any] = {
    "pydantic": pydantic,
    "typing": typing,
    "datetime": datetime,
    "enum": enum,
    "decimal": decimal,
    "uuid": uuid,
    "re": re,
}


def _safe_import(
    name: str,
    globals: dict[str, Any] | None = None,
    locals: dict[str, Any] | None = None,
    fromlist: tuple[str, ...] = (),
    level: int = 0,
) -> Any:
    if level != 0:
        raise UnsafePydanticCodeError("Relative imports are not allowed.")
    root_pkg = name.split(".")[0]
    if root_pkg not in ALLOWED_MODULES:
        raise UnsafePydanticCodeError(f"Disallowed runtime import: {name!r}")
    return __import__(name, globals, locals, fromlist, level)


_SAFE_BUILTINS: dict[str, Any] = {
    "__build_class__": __build_class__,
    "__import__": _safe_import,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "list": list,
    "dict": dict,
    "set": set,
    "tuple": tuple,
    "None": None,
    "True": True,
    "False": False,
    "object": object,
    "type": type,
    "isinstance": isinstance,
    "issubclass": issubclass,
    "property": property,
    "staticmethod": staticmethod,
    "classmethod": classmethod,
    "super": super,
    "len": len,
    "ValueError": ValueError,
    "TypeError": TypeError,
}


def _canonicalize_value(value: Any) -> str:
    if isinstance(value, enum.Enum):
        return str(value.value)
    if isinstance(value, str):
        return value
    if isinstance(value, (bool, int, float)):
        return str(value)
    if isinstance(value, (datetime.date, datetime.datetime, datetime.time)):
        return value.isoformat()
    if isinstance(value, (decimal.Decimal, uuid.UUID)):
        return str(value)
    return json.dumps(value, ensure_ascii=False)


@dataclass
class LoadedOntologyModels:
    """Container for dynamically loaded LinkML Pydantic v2 models."""

    models_by_name: dict[str, type[BaseModel]]
    envelope_model: type[BaseModel] | None = None
    _lower_lookup: dict[str, type[BaseModel]] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._lower_lookup = {
            name.lower(): model for name, model in self.models_by_name.items()
        }

    def get_model(self, class_name: str) -> type[BaseModel] | None:
        return self.models_by_name.get(class_name) or self._lower_lookup.get(
            class_name.lower()
        )

    def validate_entity_attributes(
        self,
        class_name: str,
        attributes: list[ExtractionEntityAttribute],
    ) -> tuple[list[ExtractionEntityAttribute], list[str]]:
        model = self.get_model(class_name)
        if model is None:
            return list(attributes), []

        field_lookup = {
            name.lower(): (name, info) for name, info in model.model_fields.items()
        }
        validated: list[ExtractionEntityAttribute] = []
        warnings: list[str] = []

        for attr in attributes:
            entry = field_lookup.get(attr.attribute_name.lower())
            if entry is None:
                validated.append(attr)
                continue

            field_name, field_info = entry
            annotation = field_info.annotation
            if field_info.metadata:
                target_type = Annotated[(annotation, *field_info.metadata)]
            else:
                target_type = annotation

            try:
                coerced = TypeAdapter(target_type).validate_python(attr.value)
                if coerced is None:
                    continue
                validated.append(
                    ExtractionEntityAttribute(
                        attribute_name=field_name,
                        value=_canonicalize_value(coerced),
                    )
                )
            except ValidationError as exc:
                warnings.append(
                    f"Dropped invalid attribute {class_name}.{field_name}={attr.value!r}: {exc.errors()[0]['msg']}"
                )

        return validated, warnings


def load_pydantic_extraction_models(
    pydantic_code: str,
    extraction_schema: ExtractionSchema | None = None,
) -> LoadedOntologyModels:
    """Validate and safely load LinkML-generated Pydantic v2 models."""
    del extraction_schema
    tree = validate_pydantic_ast(pydantic_code)

    namespace: dict[str, Any] = {
        "__builtins__": dict(_SAFE_BUILTINS),
        "__name__": "linkml_ontology_models",
        **_PREIMPORTED_MODULES,
    }

    compiled = compile(tree, "<linkml_pydantic>", "exec")
    exec(compiled, namespace)  # noqa: S102 - gated by validate_pydantic_ast

    models_by_name: dict[str, type[BaseModel]] = {}
    for name, obj in namespace.items():
        if (
            isinstance(obj, type)
            and issubclass(obj, BaseModel)
            and obj is not BaseModel
            and obj.__module__ == "linkml_ontology_models"
        ):
            models_by_name[name] = obj

    for model in models_by_name.values():
        model.model_rebuild(_types_namespace=namespace)

    return LoadedOntologyModels(models_by_name=models_by_name)


def validate_and_repair_entities(
    loaded: LoadedOntologyModels,
    result: ExtractionResultsResponse,
) -> ExtractionResultsResponse:
    """Validate extracted entity attributes against loaded Pydantic models, dropping only invalid attributes."""
    repaired_entities: list[ExtractionEntityResult] = []
    for entity in result.entities:
        repaired_attrs, warnings = loaded.validate_entity_attributes(
            entity.className, entity.attributes
        )
        for warning in warnings:
            logger.warning(warning)
        repaired_entities.append(
            entity.model_copy(update={"attributes": repaired_attrs})
        )

    return ExtractionResultsResponse(
        sections=result.sections,
        entities=repaired_entities,
        facts=result.facts,
    )
