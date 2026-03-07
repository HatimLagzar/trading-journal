'use client'

import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { createTradesBulk, getTrades } from '@/services/trade'
import { createSystem, getSystems } from '@/services/system'
import type { Trade, TradeInsert } from '@/services/trade'

interface ImportTradesFormProps {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

type Direction = 'long' | 'short'

type ColumnMapping = {
  trade_date: number | null
  trade_time: number | null
  coin: number | null
  system_name: number | null
  direction: number | null
  avg_entry: number | null
  avg_exit: number | null
  stop_loss: number | null
  realised_loss: number | null
  realised_win: number | null
  risk: number | null
  r_multiple: number | null
  notes: number | null
}

type MappingField = {
  key: keyof ColumnMapping
  label: string
  required?: boolean
  numeric?: boolean
}

const mappingFields: MappingField[] = [
  { key: 'trade_date', label: 'Trade Date', required: true },
  { key: 'trade_time', label: 'Trade Time (optional)' },
  { key: 'coin', label: 'Asset', required: true },
  { key: 'system_name', label: 'System Name (optional)' },
  { key: 'direction', label: 'Direction (Long/Short)' },
  { key: 'avg_entry', label: 'Entry Price', required: true, numeric: true },
  { key: 'avg_exit', label: 'Exit Price', numeric: true },
  { key: 'stop_loss', label: 'Stop Loss', numeric: true },
  { key: 'realised_loss', label: 'Realised Loss', numeric: true },
  { key: 'realised_win', label: 'Realised Win', numeric: true },
  { key: 'risk', label: 'Risk', numeric: true },
  { key: 'r_multiple', label: 'R Multiple', numeric: true },
  { key: 'notes', label: 'Notes' },
]

const initialMapping: ColumnMapping = {
  trade_date: null,
  trade_time: null,
  coin: null,
  system_name: null,
  direction: null,
  avg_entry: null,
  avg_exit: null,
  stop_loss: null,
  realised_loss: null,
  realised_win: null,
  risk: null,
  r_multiple: null,
  notes: null,
}

export default function ImportTradesForm({ userId, onClose, onSuccess }: ImportTradesFormProps) {
  const [fileName, setFileName] = useState('')
  const [rowsToSkip, setRowsToSkip] = useState(1)
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [worksheetNames, setWorksheetNames] = useState<string[]>([])
  const [sheetRowsByName, setSheetRowsByName] = useState<Record<string, string[][]>>({})
  const [selectedWorksheetName, setSelectedWorksheetName] = useState('')
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping)
  const [defaultDirection, setDefaultDirection] = useState<Direction>('long')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  const dataRows = useMemo(() => {
    return rawRows.slice(rowsToSkip).filter((row) => row.some((cell) => cell.trim() !== ''))
  }, [rawRows, rowsToSkip])

  const maxColumns = useMemo(() => {
    return rawRows.reduce((max, row) => Math.max(max, row.length), 0)
  }, [rawRows])

  const columnOptions = useMemo(() => {
    return Array.from({ length: maxColumns }, (_, index) => {
      const samples = dataRows
        .slice(0, 3)
        .map((row) => row[index] || '')
        .filter((value) => value !== '')
      const sampleText = samples.length > 0 ? `: ${samples.join(' | ')}` : ''

      return {
        value: index,
        label: `${toColumnLetter(index)}${sampleText}`,
      }
    })
  }, [dataRows, maxColumns])

  const previewRows = dataRows.slice(0, 6)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setSummary(null)
    setMapping(initialMapping)
    setWorksheetNames([])
    setSheetRowsByName({})
    setSelectedWorksheetName('')

    const lowerName = file.name.toLowerCase()
    const isDelimited = lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')

    if (!isDelimited && !isExcel) {
      setError('Please upload CSV, TSV, XLSX, or XLS file.')
      return
    }

    if (isDelimited) {
      const text = await file.text()
      const delimiter = detectDelimiter(text)
      const parsedRows = parseDelimited(text, delimiter)

      setFileName(file.name)
      setRawRows(parsedRows)
      return
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const parsedSheets = parseWorkbookSheets(workbook)
    const names = Object.keys(parsedSheets)

    if (names.length === 0) {
      setError('No worksheets found in this file.')
      return
    }

    const firstSheet = names[0]

    setFileName(file.name)
    setWorksheetNames(names)
    setSheetRowsByName(parsedSheets)
    setSelectedWorksheetName(firstSheet)
    setRawRows(parsedSheets[firstSheet] || [])
  }

  function handleWorksheetChange(name: string) {
    setSelectedWorksheetName(name)
    setRawRows(sheetRowsByName[name] || [])
    setMapping(initialMapping)
    setSummary(null)
    setError(null)
  }

  function updateMapping(field: keyof ColumnMapping, value: string) {
    setMapping((prev) => ({
      ...prev,
      [field]: value === '' ? null : Number(value),
    }))
  }

  function getPreview(columnIndex: number | null): string {
    if (columnIndex === null) return 'No column selected'

    const samples = dataRows
      .slice(0, 3)
      .map((row) => row[columnIndex] || '')
      .filter((value) => value !== '')

    if (samples.length === 0) return 'No sample values'
    return samples.join(' | ')
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSummary(null)

    if (dataRows.length === 0) {
      setError('No data rows to import. Check file and rows to skip.')
      return
    }

    const missingRequired = mappingFields
      .filter((field) => field.required && mapping[field.key] === null)
      .map((field) => field.label)

    if (missingRequired.length > 0) {
      setError(`Missing required mappings: ${missingRequired.join(', ')}`)
      return
    }

    setLoading(true)

    try {
      const importCandidates: Array<{ trade: TradeInsert; systemName: string | null }> = []
      let skipped = 0
      let ignored = 0

      dataRows.forEach((row, rowIndex) => {
        if (shouldIgnoreNonDataRow(row, mapping)) {
          ignored += 1
          return
        }

        const tradeDate = parseDateValue(getCell(row, mapping.trade_date))
        const tradeTime = parseTimeValue(getCell(row, mapping.trade_time))
        const asset = getCell(row, mapping.coin).trim()
        const systemName = getNullableText(getCell(row, mapping.system_name))
        const avgEntry = parseNumberValue(getCell(row, mapping.avg_entry))

        if (!tradeDate || !asset || avgEntry === null) {
          const reasons: string[] = []
          if (!tradeDate) reasons.push('invalid trade date')
          if (!asset) reasons.push('missing asset')
          if (avgEntry === null) reasons.push('invalid entry price')

          const sourceRowNumber = rowsToSkip + rowIndex + 1
          console.warn(
            `[ImportTrades] Skipping row ${sourceRowNumber}: ${reasons.join(', ')}`,
            { row },
          )

          skipped += 1
          return
        }

        const directionValue = parseDirectionValue(getCell(row, mapping.direction))
        const direction: Direction = directionValue ?? defaultDirection

        importCandidates.push({
          trade: {
            user_id: userId,
            trade_date: tradeDate,
            trade_time: tradeTime,
            coin: asset,
            direction,
            entry_order_type: null,
            avg_entry: avgEntry,
            stop_loss: parseNumberValue(getCell(row, mapping.stop_loss)),
            avg_exit: parseNumberValue(getCell(row, mapping.avg_exit)),
            risk: parseNumberValue(getCell(row, mapping.risk)),
            expected_loss: null,
            realised_loss: parseNumberValue(getCell(row, mapping.realised_loss)),
            realised_win: parseNumberValue(getCell(row, mapping.realised_win)),
            deviation: null,
            r_multiple: parseNumberValue(getCell(row, mapping.r_multiple)),
            early_exit_reason: null,
            rules: null,
            system_number: null,
            system_id: null,
            sub_system_id: null,
            notes: getNullableText(getCell(row, mapping.notes)),
          },
          systemName,
        })
      })

      if (importCandidates.length === 0) {
        setError('No valid rows found after mapping. Please verify your column mapping.')
        return
      }

      const existingSystems = await getSystems(userId)
      const systemIdByName = new Map<string, string>()

      existingSystems.forEach((system) => {
        const key = normalizeSystemName(system.name)
        if (!key) return
        systemIdByName.set(key, system.id)
      })

      let createdSystems = 0

      for (const candidate of importCandidates) {
        const systemNameText = candidate.systemName
        if (!systemNameText) continue

        const normalizedSystemName = normalizeSystemName(systemNameText)
        if (!normalizedSystemName) continue

        let systemId = systemIdByName.get(normalizedSystemName)

        if (!systemId) {
          const created = await createSystem({
            user_id: userId,
            name: systemNameText,
            entry_rules: null,
            sl_rules: null,
            tp_rules: null,
            description: null,
          })
          const createdId = created.id
          if (!createdId) {
            throw new Error(`Failed to create system for "${systemNameText}"`)
          }
          systemId = createdId
          systemIdByName.set(normalizedSystemName, createdId)
          createdSystems += 1
        }

        if (!systemId) continue

        candidate.trade.system_id = systemId
      }

      const existingTrades = await getTrades(userId)
      const existingSignatures = new Set(existingTrades.map(buildTradeSignatureFromExisting))
      const batchSignatures = new Set<string>()

      const newTrades: TradeInsert[] = []
      let duplicatesExisting = 0
      let duplicatesInFile = 0

      importCandidates.forEach((candidate) => {
        const trade = candidate.trade
        const signature = buildTradeSignatureFromInsert(trade)

        if (existingSignatures.has(signature)) {
          duplicatesExisting += 1
          return
        }

        if (batchSignatures.has(signature)) {
          duplicatesInFile += 1
          return
        }

        batchSignatures.add(signature)
        newTrades.push(trade)
      })

      if (newTrades.length === 0) {
        const summaryParts = ['No new trades imported.']
        if (createdSystems > 0) summaryParts.push(`Created ${createdSystems} systems.`)
        if (duplicatesExisting > 0) summaryParts.push(`Found ${duplicatesExisting} already existing rows.`)
        if (duplicatesInFile > 0) summaryParts.push(`Found ${duplicatesInFile} duplicate rows in file.`)
        if (ignored > 0) summaryParts.push(`Ignored ${ignored} non-data rows.`)
        if (skipped > 0) summaryParts.push(`Skipped ${skipped} invalid rows.`)
        setSummary(summaryParts.join(' '))
        return
      }

      await createTradesBulk(newTrades)
      const summaryParts = [`Imported ${newTrades.length} trades.`]
      if (createdSystems > 0) summaryParts.push(`Created ${createdSystems} new systems.`)
      if (duplicatesExisting > 0) summaryParts.push(`Skipped ${duplicatesExisting} existing duplicates.`)
      if (duplicatesInFile > 0) summaryParts.push(`Skipped ${duplicatesInFile} file duplicates.`)
      if (ignored > 0) summaryParts.push(`Ignored ${ignored} non-data rows.`)
      if (skipped > 0) summaryParts.push(`Skipped ${skipped} invalid rows.`)
      setSummary(summaryParts.join(' '))
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import trades')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleImport} className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Import Trades</h2>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ✕
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Upload CSV/TSV/XLSX, map columns, preview values, and import in bulk.
      </p>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}
      {summary && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{summary}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">File</label>
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border rounded-lg"
          />
          {fileName && <p className="text-xs text-gray-500 mt-1">Loaded: {fileName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rows to Skip</label>
          <input
            type="number"
            min="0"
            value={rowsToSkip}
            onChange={(e) => setRowsToSkip(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {worksheetNames.length > 1 && (
        <div>
          <label className="block text-sm font-medium mb-1">Worksheet</label>
          <select
            value={selectedWorksheetName}
            onChange={(e) => handleWorksheetChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            {worksheetNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Default Direction (if not mapped)</label>
        <select
          value={defaultDirection}
          onChange={(e) => setDefaultDirection(e.target.value as Direction)}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
      </div>

      {rawRows.length > 0 && (
        <>
          <div className="border rounded-lg p-3 space-y-3">
            <h3 className="text-sm font-semibold">Column Mapping + Preview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mappingFields.map((field) => (
                <div key={field.key} className="border rounded-md p-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) => updateMapping(field.key, e.target.value)}
                    className="w-full px-2 py-1.5 border rounded"
                  >
                    <option value="">Not mapped</option>
                    {columnOptions.map((column) => (
                      <option key={column.value} value={column.value}>{column.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">{getPreview(mapping[field.key])}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 text-sm font-medium">Rows Preview</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-t">
                  <tr>
                    {Array.from({ length: maxColumns }, (_, index) => (
                      <th key={index} className="px-2 py-1 text-left border-r last:border-r-0">
                        {toColumnLetter(index)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t">
                      {Array.from({ length: maxColumns }, (_, colIndex) => (
                        <td key={colIndex} className="px-2 py-1 border-r last:border-r-0 whitespace-nowrap">
                          {row[colIndex] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {previewRows.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(maxColumns, 1)} className="px-2 py-3 text-center text-gray-500">
                        No preview rows available after skip.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || rawRows.length === 0}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Importing...' : 'Import Trades'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function toColumnLetter(index: number): string {
  let letter = ''
  let num = index

  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter
    num = Math.floor(num / 26) - 1
  }

  return letter
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || ''
  const candidates = [',', '\t', ';']

  let best = ','
  let bestCount = -1

  candidates.forEach((candidate) => {
    const count = firstLine.split(candidate).length
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  })

  return best
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell.trim())
      cell = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    rows.push(row)
  }

  return rows
}

function parseWorkbookSheets(workbook: XLSX.WorkBook): Record<string, string[][]> {
  const sheets: Record<string, string[][]> = {}

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) return

    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    })

    sheets[sheetName] = rows.map((row) => row.map((cell) => `${cell ?? ''}`.trim()))
  })

  return sheets
}

function getCell(row: string[], columnIndex: number | null): string {
  if (columnIndex === null) return ''
  return row[columnIndex] ?? ''
}

function shouldIgnoreNonDataRow(row: string[], mapping: ColumnMapping): boolean {
  const requiredCells = [
    getCell(row, mapping.trade_date).trim(),
    getCell(row, mapping.coin).trim(),
    getCell(row, mapping.avg_entry).trim(),
  ]

  // If every required mapped field is empty, treat as a non-data row.
  return requiredCells.every((value) => value === '')
}

function parseNumberValue(value: string): number | null {
  if (!value) return null
  const trimmed = value.trim()
  const isParenthesesNegative = /^\(.*\)$/.test(trimmed)
  const unwrapped = isParenthesesNegative ? trimmed.slice(1, -1) : trimmed
  const cleaned = unwrapped.replace(/[,$Rr\s]/g, '')
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null
  return isParenthesesNegative ? -parsed : parsed
}

function parseDirectionValue(value: string): Direction | null {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'long' || normalized === 'buy' || normalized === 'l') return 'long'
  if (normalized === 'short' || normalized === 'sell' || normalized === 's') return 'short'
  return null
}

function parseDateValue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4))
    const month = Number(trimmed.slice(4, 6))
    const day = Number(trimmed.slice(6, 8))
    const parsed = fromDateParts(year, month, day)
    return parsed ? formatDate(parsed) : null
  }

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const date = new Date(trimmed)
    if (Number.isNaN(date.getTime())) return null
    return formatDate(date)
  }

  if (/^\d{4}[\/.]\d{1,2}[\/.]\d{1,2}$/.test(trimmed)) {
    const [yearText, monthText, dayText] = trimmed.split(/[\/.]/)
    const parsed = fromDateParts(Number(yearText), Number(monthText), Number(dayText))
    return parsed ? formatDate(parsed) : null
  }

  if (/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(trimmed)) {
    const [firstText, secondText, thirdText] = trimmed.split(/[\/.\-]/)
    const first = Number(firstText)
    const second = Number(secondText)
    const year = normalizeYear(Number(thirdText))

    // Prefer DD/MM if first > 12, MM/DD if second > 12, otherwise default to DD/MM.
    const ddMmCandidate = fromDateParts(year, second, first)
    const mmDdCandidate = fromDateParts(year, first, second)

    if (first > 12 && ddMmCandidate) return formatDate(ddMmCandidate)
    if (second > 12 && mmDdCandidate) return formatDate(mmDdCandidate)
    if (ddMmCandidate) return formatDate(ddMmCandidate)
    if (mmDdCandidate) return formatDate(mmDdCandidate)
    return null
  }

  if (/^\d{1,2}[\/.\-]\d{1,2}$/.test(trimmed)) {
    const [firstText, secondText] = trimmed.split(/[\/.\-]/)
    const first = Number(firstText)
    const second = Number(secondText)
    const currentYear = new Date().getFullYear()

    const ddMmCandidate = fromDateParts(currentYear, second, first)
    const mmDdCandidate = fromDateParts(currentYear, first, second)

    // Default to day/month unless only month/day is valid.
    if (ddMmCandidate) return formatDate(ddMmCandidate)
    if (mmDdCandidate) return formatDate(mmDdCandidate)
    return null
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed)
    if (!Number.isFinite(serial)) return null
    const epoch = Date.UTC(1899, 11, 30)
    const date = new Date(epoch + serial * 86400000)
    if (Number.isNaN(date.getTime())) return null
    return formatDate(date)
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return formatDate(parsed)
}

function parseTimeValue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // Excel time serial (fraction of a day)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed)
    if (!Number.isFinite(serial)) return null
    const dayFraction = serial % 1
    if (dayFraction <= 0) return null
    const totalSeconds = Math.round(dayFraction * 24 * 60 * 60)
    const hours = Math.floor(totalSeconds / 3600) % 24
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`
  }

  // 24h: HH:MM or HH:MM:SS
  const time24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (time24) {
    const hours = Number(time24[1])
    const minutes = Number(time24[2])
    const seconds = Number(time24[3] ?? '0')
    if (hours < 0 || hours > 23 || minutes > 59 || seconds > 59) return null
    return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`
  }

  // 12h: h:mm AM/PM
  const time12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/)
  if (time12) {
    let hours = Number(time12[1])
    const minutes = Number(time12[2])
    const seconds = Number(time12[3] ?? '0')
    const meridiem = time12[4].toLowerCase()

    if (hours < 1 || hours > 12 || minutes > 59 || seconds > 59) return null
    if (meridiem === 'pm' && hours !== 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0

    return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`
  }

  // Date-time strings
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return `${`${parsed.getHours()}`.padStart(2, '0')}:${`${parsed.getMinutes()}`.padStart(2, '0')}:${`${parsed.getSeconds()}`.padStart(2, '0')}`
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateParts(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(year, month - 1, day)
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function normalizeYear(year: number): number {
  if (year >= 100) return year
  return year >= 70 ? 1900 + year : 2000 + year
}

function getNullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function buildTradeSignatureFromInsert(trade: TradeInsert): string {
  return JSON.stringify([
    trade.trade_date,
    trade.trade_time,
    normalizeText(trade.coin),
    trade.direction,
    normalizeText(trade.entry_order_type),
    normalizeNumber(trade.avg_entry),
    normalizeNumber(trade.stop_loss),
    normalizeNumber(trade.avg_exit),
    normalizeNumber(trade.risk),
    normalizeNumber(trade.expected_loss),
    normalizeNumber(trade.realised_loss),
    normalizeNumber(trade.realised_win),
    normalizeNumber(trade.deviation),
    normalizeNumber(trade.r_multiple),
    normalizeText(trade.early_exit_reason),
    normalizeText(trade.rules),
    normalizeText(trade.system_number),
    trade.system_id,
    trade.sub_system_id,
    normalizeText(trade.notes),
  ])
}

function buildTradeSignatureFromExisting(trade: Trade): string {
  return JSON.stringify([
    trade.trade_date,
    trade.trade_time,
    normalizeText(trade.coin),
    trade.direction,
    normalizeText(trade.entry_order_type),
    normalizeNumber(trade.avg_entry),
    normalizeNumber(trade.stop_loss),
    normalizeNumber(trade.avg_exit),
    normalizeNumber(trade.risk),
    normalizeNumber(trade.expected_loss),
    normalizeNumber(trade.realised_loss),
    normalizeNumber(trade.realised_win),
    normalizeNumber(trade.deviation),
    normalizeNumber(trade.r_multiple),
    normalizeText(trade.early_exit_reason),
    normalizeText(trade.rules),
    normalizeText(trade.system_number),
    trade.system_id,
    trade.sub_system_id,
    normalizeText(trade.notes),
  ])
}

function normalizeSystemName(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed.toLowerCase()
}

function normalizeText(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed.toLowerCase()
}

function normalizeNumber(value: number | null): number | null {
  if (value === null) return null
  return Number(value.toFixed(8))
}
