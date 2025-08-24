"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react"

/**
 * Base type that all DataTable-compatible types must extend
 * This ensures compatibility with the DataTable's generic constraint
 */
export type DataTableCompatible = Record<string, unknown> & {
  [K in string]: unknown;
};

/**
 * Generic column interface with enhanced type safety
 * T must extend DataTableCompatible to ensure proper typing
 */
interface Column<T extends DataTableCompatible> {
  key: keyof T | string // Allow string keys for backward compatibility
  header: string
  render?: (value: unknown, row: T) => React.ReactNode
  sortable?: boolean
  searchable?: boolean
}

/**
 * Type-safe column render function helper
 * Provides safe type conversion from unknown to expected types
 */
export const createTypedRender = <T extends DataTableCompatible, K extends keyof T>(
  renderFn: (value: T[K], row: T) => React.ReactNode
) => {
  return (value: unknown, row: T): React.ReactNode => {
    // Type assertion is safe here because we know the value comes from row[key]
    return renderFn(value as T[K], row);
  };
};

/**
 * Type guards for common data types used in render functions
 */
export const typeGuards = {
  isString: (value: unknown): value is string => typeof value === 'string',
  isNumber: (value: unknown): value is number => typeof value === 'number',
  isBoolean: (value: unknown): value is boolean => typeof value === 'boolean',
  isStringOrNull: (value: unknown): value is string | null => 
    typeof value === 'string' || value === null,
  isNumberOrNull: (value: unknown): value is number | null => 
    typeof value === 'number' || value === null,
  isStringOrUndefined: (value: unknown): value is string | undefined => 
    typeof value === 'string' || value === undefined,
  isDate: (value: unknown): value is Date => value instanceof Date,
  isDateString: (value: unknown): value is string => 
    typeof value === 'string' && !isNaN(Date.parse(value)),
};

export type { Column }

interface DataTableProps<T extends DataTableCompatible> {
  data: T[]
  columns: Column<T>[]
  pageSize?: number
  searchable?: boolean
  sortable?: boolean
  className?: string
}

export function DataTable<T extends DataTableCompatible>({
  data,
  columns,
  pageSize = 10,
  searchable = true,
  sortable = true,
  className = "",
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Filter data based on search term
  const filteredData = searchable
    ? data.filter((row) =>
      columns.some((column) => {
        if (column.searchable === false) return false
        const value = row[column.key]
        return value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      }),
    )
    : data

  // Sort data
  const sortedData =
    sortable && sortColumn
      ? [...filteredData].sort((a, b) => {
        const aValue = a[sortColumn]
        const bValue = b[sortColumn]

        if (aValue === bValue) return 0

        // Safe comparison for unknown types
        const comparison = (() => {
          if (aValue == null && bValue == null) return 0
          if (aValue == null) return -1
          if (bValue == null) return 1
          
          // Convert to strings for safe comparison
          const aStr = String(aValue)
          const bStr = String(bValue)
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
        })()
        
        return sortDirection === "asc" ? comparison : -comparison
      })
      : filteredData

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize)

  const handleSort = (columnKey: string) => {
    if (!sortable) return

    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(columnKey)
      setSortDirection("asc")
    }
  }

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search */}
      {searchable && (
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1) // Reset to first page when searching
              }}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-slate-500">
            {filteredData.length} of {data.length} items
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`px-4 py-3 text-left text-sm font-medium text-slate-600 ${sortable && column.sortable !== false ? "cursor-pointer hover:bg-slate-100" : ""
                      }`}
                    onClick={() => sortable && column.sortable !== false && handleSort(String(column.key))}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.header}</span>
                      {sortable && column.sortable !== false && sortColumn === String(column.key) && (
                        <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                    {searchTerm ? "No results found" : "No data available"}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    {columns.map((column) => (
                      <td key={String(column.key)} className="px-4 py-3 text-sm text-slate-900">
                        {column.render ? column.render(row[column.key], row) : row[column.key]?.toString() || "—"}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, sortedData.length)} of {sortedData.length}{" "}
            results
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => goToPage(1)} disabled={currentPage === 1}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center space-x-1">
              <span className="text-sm text-slate-600">Page</span>
              <Select value={currentPage.toString()} onValueChange={(value) => goToPage(Number.parseInt(value))}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <SelectItem key={page} value={page.toString()}>
                      {page}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-600">of {totalPages}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
