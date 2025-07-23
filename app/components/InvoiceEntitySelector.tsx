import { useState, useEffect } from "react";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { InvoiceEntity } from "~/types/invoice";

interface InvoiceEntitySelectorProps {
  selectedEntity?: InvoiceEntity | null;
  onEntitySelect: (entity: InvoiceEntity | null) => void;
  onCreateNew?: () => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

export function InvoiceEntitySelector({
  selectedEntity,
  onEntitySelect,
  onCreateNew,
  placeholder = "Search for an entity...",
  disabled = false,
  error,
  required = false,
}: InvoiceEntitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [entities, setEntities] = useState<InvoiceEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Debounced search function
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchTerm.length >= 2) {
      const timeout = setTimeout(async () => {
        setLoading(true);
        try {
          const response = await fetch(
            `/api/invoice-entities/search?q=${encodeURIComponent(searchTerm)}`
          );
          if (response.ok) {
            const data = await response.json();
            setEntities(data.entities || []);
          }
        } catch (error) {
          console.error("Error searching entities:", error);
        } finally {
          setLoading(false);
        }
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setEntities([]);
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTerm, searchTimeout]);

  const handleEntitySelect = (entity: InvoiceEntity) => {
    onEntitySelect(entity);
    setIsOpen(false);
    setSearchTerm("");
    setEntities([]);
  };

  const handleClear = () => {
    onEntitySelect(null);
    setSearchTerm("");
    setEntities([]);
  };

  const displayName = selectedEntity
    ? `${selectedEntity.name} (${selectedEntity.entity_type})`
    : "";

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          className={`input-custom-styles pl-10 pr-3 ${
            error ? "ring-red-300 focus:ring-red-500" : ""
          } ${disabled ? "bg-gray-50 text-gray-500" : ""}`}
          placeholder={selectedEntity ? displayName : placeholder}
          value={isOpen ? searchTerm : displayName}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay closing to allow for entity selection
            setTimeout(() => setIsOpen(false), 200);
          }}
          disabled={disabled}
          required={required}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
        {selectedEntity && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            disabled={disabled}
          >
            <span className="sr-only">Clear selection</span>
            ×
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600" id="entity-error">
          {error}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && (searchTerm.length >= 2 || entities.length > 0) && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-600 focus:outline-none sm:text-sm">
          {loading && (
            <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-green-600"></div>
                Searching...
              </div>
            </div>
          )}

          {!loading && entities.length === 0 && searchTerm.length >= 2 && (
            <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
              No entities found for &quot;{searchTerm}&quot;
              {onCreateNew && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateNew();
                    setIsOpen(false);
                  }}
                  className="ml-2 inline-flex items-center text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300"
                >
                  <PlusIcon className="mr-1 h-4 w-4" />
                  Create new
                </button>
              )}
            </div>
          )}

          {!loading &&
            entities.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => handleEntitySelect(entity)}
                className="block w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{entity.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {entity.entity_type} • {entity.email || "No email"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {entity.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-2 py-1 text-xs font-medium text-green-800 dark:text-green-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-800 dark:text-gray-200">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}

          {onCreateNew && entities.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => {
                  onCreateNew();
                  setIsOpen(false);
                }}
                className="flex w-full items-center px-4 py-2 text-green-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none dark:text-green-400"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Create new entity
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}