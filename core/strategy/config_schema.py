"""
Config Schema — описание и валидация параметров конфигурации стратегии.

Схема задаётся в manifest.yaml стратегии в поле `config_schema`:

    config_schema:
      parameters:
        ema_fast:
          type: int
          default: 9
          min: 3
          max: 50
          description: "Fast EMA period"
        ema_slow:
          type: int
          default: 21
          min: 5
          max: 100
        rsi_period:
          type: int
          default: 14
        use_trailing_stop:
          type: bool
          default: false

После загрузки:
  1. Schema читается из manifest.yaml
  2. config.yaml стратегии валидируется по схеме
  3. Пропущенные поля заполняются default'ами
  4. Типы приводятся (int/float/bool/str/list)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, get_type_hints

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
#  Типы параметров
# ═══════════════════════════════════════════════════════════════════

VALID_TYPES = {"int", "float", "bool", "str", "list", "dict"}


@dataclass
class ParamSchema:
    """Схема одного параметра конфигурации.

    Attributes:
        type:       Python-тип значения (int, float, bool, str, list, dict).
        default:    Значение по умолчанию.
        min:        Минимальное значение (для int/float).
        max:        Максимальное значение (для int/float).
        choices:    Список допустимых значений (для str/int).
        description: Человеко-читаемое описание.
        required:   True — параметр обязателен.
        nullable:   True — допускается None.
    """

    type: str = "str"
    default: Any = None
    min: float | None = None
    max: float | None = None
    choices: list[Any] | None = None
    description: str = ""
    required: bool = False
    nullable: bool = False

    def __post_init__(self) -> None:
        if self.type not in VALID_TYPES:
            raise ValueError(
                f"Invalid param type '{self.type}'. "
                f"Valid: {', '.join(sorted(VALID_TYPES))}"
            )

    @property
    def python_type(self) -> type:
        return _TYPE_MAP[self.type]

    def coerce(self, value: Any) -> Any:
        """Привести значение к нужному типу."""
        if value is None and self.nullable:
            return None

        py_type = self.python_type
        if py_type == bool:
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ("true", "1", "yes", "on")
            if isinstance(value, (int, float)):
                return value != 0
            return bool(value)
        try:
            return py_type(value)  # type: ignore[call-arg]
        except (TypeError, ValueError):
            return self.default

    def validate(self, value: Any, path: str = "") -> list[str]:
        """Валидировать значение по схеме.

        Args:
            value: Значение для проверки.
            path:  Путь к параметру (для сообщений об ошибках).

        Returns:
            Список ошибок валидации (пустой если всё ОК).
        """
        errors: list[str] = []
        prefix = f"{path}: " if path else ""

        if value is None:
            if self.required and not self.nullable:
                errors.append(f"{prefix}Required parameter is missing")
            return errors

        # Проверка типа
        py_type = self.python_type
        if not isinstance(value, py_type):
            # Попытка приведения
            try:
                coerced = self.coerce(value)
                if coerced is None and not self.nullable:
                    errors.append(
                        f"{prefix}Expected {self.type}, got {type(value).__name__}"
                    )
                    return errors
            except (TypeError, ValueError):
                errors.append(
                    f"{prefix}Expected {self.type}, got {type(value).__name__}"
                )
                return errors
            value = coerced

        # Проверка min/max
        if self.min is not None and isinstance(value, (int, float)):
            if value < self.min:
                errors.append(
                    f"{prefix}Value {value} is less than minimum {self.min}"
                )

        if self.max is not None and isinstance(value, (int, float)):
            if value > self.max:
                errors.append(
                    f"{prefix}Value {value} is greater than maximum {self.max}"
                )

        # Проверка choices
        if self.choices is not None and value not in self.choices:
            errors.append(
                f"{prefix}Value {value!r} is not in allowed choices: {self.choices}"
            )

        return errors


_TYPE_MAP: dict[str, type] = {
    "int": int,
    "float": float,
    "bool": bool,
    "str": str,
    "list": list,
    "dict": dict,
}


# ═══════════════════════════════════════════════════════════════════
#  Schema — полная схема конфига стратегии
# ═══════════════════════════════════════════════════════════════════


@dataclass
class ConfigSchema:
    """Схема конфигурации стратегии.

    Содержит описание всех параметров, их типы, дефолты и ограничения.

    Attributes:
        parameters:   Словарь {имя_параметра → ParamSchema}.
        description:  Общее описание конфига (опционально).
        version:      Версия схемы (для миграций).
    """

    parameters: dict[str, ParamSchema] = field(default_factory=dict)
    description: str = ""
    version: str = "1.0"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ConfigSchema:
        """Создать ConfigSchema из сырого dict (из manifest.yaml).

        Args:
            data: Содержимое config_schema из manifest.yaml.

        Returns:
            ConfigSchema.

        Raises:
            ValueError: Если формат невалиден.
        """
        raw_params = data.get("parameters", {})
        if not isinstance(raw_params, dict):
            raise ValueError(
                f"config_schema.parameters must be a dict, "
                f"got {type(raw_params).__name__}"
            )

        parameters: dict[str, ParamSchema] = {}
        for name, raw in raw_params.items():
            if not isinstance(raw, dict):
                raise ValueError(
                    f"config_schema.parameters.{name} must be a dict, "
                    f"got {type(raw).__name__}"
                )
            parameters[name] = ParamSchema(
                type=str(raw.get("type", "str")),
                default=raw.get("default"),
                min=raw.get("min"),
                max=raw.get("max"),
                choices=raw.get("choices"),
                description=str(raw.get("description", "")),
                required=bool(raw.get("required", False)),
                nullable=bool(raw.get("nullable", False)),
            )

        return cls(
            parameters=parameters,
            description=str(data.get("description", "")),
            version=str(data.get("version", "1.0")),
        )

    def to_dict(self) -> dict[str, Any]:
        """Сериализовать в dict (для YAML дампа)."""
        return {
            "version": self.version,
            "description": self.description,
            "parameters": {
                name: {
                    "type": p.type,
                    "default": p.default,
                    "description": p.description,
                    "min": p.min,
                    "max": p.max,
                    "choices": p.choices,
                    "required": p.required,
                    "nullable": p.nullable,
                }
                for name, p in self.parameters.items()
                if p.type != "str" or p.default is not None or p.description
            },
        }

    def default_parameters(self) -> dict[str, Any]:
        """Получить значения параметров по умолчанию.

        Returns:
            dict {имя_параметра → значение_по_умолчанию}.
        """
        import copy

        result: dict[str, Any] = {}
        for name, param in self.parameters.items():
            default = param.default
            if isinstance(default, (list, dict)):
                default = copy.deepcopy(default)
            result[name] = default
        return result

    def validate(
        self,
        config: dict[str, Any],
        source: str = "config",
    ) -> list[str]:
        """Валидировать словарь конфига по схеме.

        Args:
            config:  Словарь конфига (из config.yaml).
            source:  Имя источника (для сообщений об ошибках).

        Returns:
            Список ошибок валидации.
        """
        errors: list[str] = []

        for name, param_schema in self.parameters.items():
            if name in config:
                value = config[name]
                path = f"{source}.{name}"
                errors.extend(param_schema.validate(value, path))
            elif param_schema.required:
                errors.append(f"{source}: Missing required parameter '{name}'")

        # Предупреждения о неизвестных параметрах
        for name in config:
            if name not in self.parameters:
                errors.append(f"{source}: Unknown parameter '{name}'")

        return errors

    def apply_defaults(self, config: dict[str, Any]) -> dict[str, Any]:
        """Заполнить отсутствующие параметры значениями по умолчанию.

        Args:
            config: Исходный конфиг.

        Returns:
            Конфиг со всеми обязательными полями.
        """
        result = dict(config)
        for name, param_schema in self.parameters.items():
            if name not in result:
                default = param_schema.default
                # Копируем list/dict, чтобы избежать мутации
                if isinstance(default, (list, dict)):
                    import copy

                    default = copy.deepcopy(default)
                result[name] = default
        return result

    def coerce_types(self, config: dict[str, Any]) -> dict[str, Any]:
        """Привести типы значений к правильным.

        Args:
            config: Исходный конфиг.

        Returns:
            Конфиг с приведёнными типами.
        """
        result = dict(config)
        for name, param_schema in self.parameters.items():
            if name in result and result[name] is not None:
                result[name] = param_schema.coerce(result[name])
        return result


# ═══════════════════════════════════════════════════════════════════
#  Встраивание в PluginLoader
# ═══════════════════════════════════════════════════════════════════


def validate_config_with_schema(
    config: dict[str, Any],
    schema: ConfigSchema | None,
    source: str = "config",
) -> list[str]:
    """Валидировать конфиг стратегии по схеме.

    Args:
        config:  Конфиг стратегии.
        schema:  Схема конфига (None = нет проверки).
        source:  Имя источника для ошибок.

    Returns:
        Список ошибок (пустой = OK).
    """
    if schema is None:
        return []
    errors = schema.validate(config, source)
    return errors


def normalize_config(
    config: dict[str, Any],
    schema: ConfigSchema | None,
) -> dict[str, Any]:
    """Нормализовать конфиг: заполнить дефолты + привести типы.

    Args:
        config:  Исходный конфиг.
        schema:  Схема (None = вернуть как есть).

    Returns:
        Нормализованный конфиг.
    """
    if schema is None:
        return dict(config)

    result = schema.apply_defaults(config)
    result = schema.coerce_types(result)
    return result


__all__ = [
    "ConfigSchema",
    "ParamSchema",
    "normalize_config",
    "validate_config_with_schema",
]
