import { useState, useEffect, useRef, useMemo } from "react";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Link } from "@remix-run/react";
import { InvoiceEntity } from "~/types/invoice";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface InvoiceEntitySelectorProps {
  entities?: InvoiceEntity[];
  selectedEntity?: InvoiceEntity | null;
  onEntitySelect: (entity: InvoiceEntity | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

export function InvoiceEntitySelector({
  entities = [],
  selectedEntity,
  onEntitySelect,
  placeholder = "Search entities by name, type, or email...",
  disabled = false,
  error,
}: InvoiceEntitySelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<InvoiceEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filter entities for display (show active entities first, then inactive) - memoized
  const sortedEntities = useMemo(() => {
    return [...entities].sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [entities]);

  // Filter entities based on search term (local filtering) - memoized
  const filteredEntities = useMemo(() => {
    if (!searchTerm.trim()) {
      return sortedEntities;
    }
    
    const term = searchTerm.toLowerCase();
    return sortedEntities.filter(entity => 
      entity.name.toLowerCase().includes(term) ||
      entity.entity_type.toLowerCase().includes(term) ||
      (entity.email && entity.email.toLowerCase().includes(term))
    );
  }, [searchTerm, sortedEntities]);

  // Auto-focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Debounced search function for additional API search (when local results are insufficient)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Only do API search if we have a search term and local results are limited
    if (searchTerm.length >= 2 && filteredEntities.length < 3) {
      const timeout = setTimeout(async () => {
        setLoading(true);
        try {
          const response = await fetch(
            `/api/invoice-entities/search?q=${encodeURIComponent(searchTerm)}`
          );
          if (response.ok) {
            const data = await response.json();
            // Merge API results with local results, avoiding duplicates
            const apiResults = data.entities || [];
            const existingIds = new Set(filteredEntities.map(e => e.id));
            const newResults = apiResults.filter((e: InvoiceEntity) => !existingIds.has(e.id));
            setSearchResults([...filteredEntities, ...newResults]);
          }
        } catch (error) {
          console.error("Error searching entities:", error);
          setSearchResults(filteredEntities);
        } finally {
          setLoading(false);
        }
      }, 300);
      searchTimeoutRef.current = timeout;
    } else {
      setSearchResults(filteredEntities);
      setLoading(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, filteredEntities]);

  const handleEntitySelect = (entity: InvoiceEntity) => {
    onEntitySelect(entity);
    setSearchTerm("");
    setSearchResults([]);
  };

  const clearSelection = () => {
    onEntitySelect(null);
    setSearchTerm("");
    setSearchResults([]);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  return (
    <div className="space-y-3">
      {/* Selected Entity Display */}
      {selectedEntity && (
        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <div>
            <div className="font-medium text-green-900 dark:text-green-100">{selectedEntity.name}</div>
            <div className="text-sm text-green-700 dark:text-green-300">
              {selectedEntity.entity_type} • {selectedEntity.email || "No email"}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSelection}
            className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-900/40"
          >
            Change
          </Button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Input
          ref={searchInputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`pl-10 ${error ? "ring-red-300 focus:ring-red-500" : ""}`}
          disabled={disabled}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
      </div>

      {/* Filtered Results */}
      <div className="max-h-60 overflow-auto rounded-md border bg-white dark:bg-gray-800 py-1 shadow-lg">
        {loading && searchTerm.length >= 2 && (
          <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
            <div className="flex items-center">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-green-600"></div>
              Searching additional entities...
            </div>
          </div>
        )}

        {searchResults.length === 0 && !loading && (
          <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
            {searchTerm.trim() 
              ? `No entities found for &quot;${searchTerm}&quot;`
              : "Start typing to search entities..."
            }
          </div>
        )}

        {/* Active Entities */}
        {searchResults.filter(e => e.is_active).map((entity) => (
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
                <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-2 py-1 text-xs font-medium text-green-800 dark:text-green-200">
                  Active
                </span>
              </div>
            </div>
          </button>
        ))}

        {/* Inactive Entities (if any) */}
        {searchResults.filter(e => !e.is_active).length > 0 && (
          <>
            {searchResults.filter(e => e.is_active).length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
            )}
            {searchResults.filter(e => !e.is_active).map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => handleEntitySelect(entity)}
                className="block w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-500 dark:text-gray-400">{entity.name}</div>
                    <div className="text-sm text-gray-400 dark:text-gray-500">
                      {entity.entity_type} • Inactive
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-800 dark:text-gray-200">
                      Inactive
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </>
        )}

        {/* Create New Option */}
        {searchTerm.trim() && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
            <Link
              to="/admin/invoice-entities/new"
              className="block w-full px-4 py-2 text-left hover:bg-green-50 dark:hover:bg-green-900/20 focus:bg-green-50 dark:focus:bg-green-900/20 focus:outline-none text-green-600 dark:text-green-400"
            >
              <div className="flex items-center">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create new entity &quot;{searchTerm}&quot;
              </div>
            </Link>
          </>
        )}
      </div>

      {/* Search Stats and Quick Actions */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {searchTerm.trim() ? (
            <>Showing {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</>
          ) : (
            <>Search through {entities.length} entities</>
          )}
        </span>
        <Link 
          to="/admin/invoice-entities/new" 
          className="text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300 flex items-center"
        >
          <PlusIcon className="mr-1 h-3 w-3" />
          Create new
        </Link>
      </div>

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
}