'use client'

import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { createBacktestingTradesBulk, getBacktestingTrades } from '@/services/backtesting'
import type { BacktestingTrade, BacktestingTradeInsert } from '@/services/backtesting'

interface ImportBacktestingTradesFormProps {
  userId: string
  sessionId: string
  onClose: () => void
  onSuccess: () => void
}

type Direction = 'long' | 'short'

type ColumnMapping = {
  trade_date: number | null
  trade_time: number | null
  asset: number | null
  direction: number | null
  entry_price: number | null
  stop_loss: number | null
  target_price: number | null
  outcome_r: number | null
  notes: number | null
}

type MappingField = {
  key: keyof ColumnMapping
  label: string
  required?: boolean
}

const mappingFields: MappingField[] = [
  { key: 'trade_date', label: 'Trade Date' },
  { key: 'trade_time', label: 'Trade Time (optional)' },
  { key: 'asset', label: 'Asset', required: true },
  { key: 'direction', label: 'Direction (optional)' },
  { key: 'entry_price', label: 'Entry Price (optional)' },
  { key: 'stop_loss', label: 'Stop Loss (optional)' },
  { key: 'target_price', label: 'Target Price (optional)' },
  { key: 'outcome_r', label: 'Profit (R) (optional)' },
  { key: 'notes', label: 'Notes (optional)' },
]

const initialMapping: ColumnMapping = {
  trade_date: null,
  trade_time: null,
  asset: null,
  direction: null,
  entry_price: null,
  stop_loss: null,
  target_price: null,
  outcome_r: null,
  notes: null,
}

export default function ImportBacktestingTradesForm({
  userId,
  sessionId,
  onClose,
  onSuccess,
}: ImportBacktestingTradesFormProps) {
  const [fileName, setFileName] = useState('')
  const [rowsToSkip, setRowsToSkip] = useState(0)
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

      return {
        value: index,
        label: `${toColumnLetter(index)}${samples.length > 0 ? `: ${samples.join(' | ')}` : ''}`,
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
      const importableTrades: BacktestingTradeInsert[] = []
      let skipped = 0
      let ignored = 0

      dataRows.forEach((row, rowIndex) => {
        if (shouldIgnoreNonDataRow(row, mapping)) {
          ignored += 1
          return
        }

        const rawDateCell = getCell(row, mapping.trade_date)
        const parsedDateAndTime = parseDateAndOptionalTime(rawDateCell)
        const hasProvidedDateValue = mapping.trade_date !== null && rawDateCell.trim() !== ''
        const tradeDate = parsedDateAndTime.date ?? getTodayDateString()
        const tradeTime = parseTimeValue(getCell(row, mapping.trade_time)) ?? parsedDateAndTime.time
        const asset = getCell(row, mapping.asset).trim()

        const entry = parseNumberValue(getCell(row, mapping.entry_price))
        const stopLoss = parseNumberValue(getCell(row, mapping.stop_loss))
        const target = parseNumberValue(getCell(row, mapping.target_price))

        const direction = parseDirectionValue(getCell(row, mapping.direction)) ?? detectDirection(entry, stopLoss) ?? defaultDirection

        const mappedProfit = parseNumberValue(getCell(row, mapping.outcome_r))
        const calculatedProfit = calculateOutcomeR(entry, stopLoss, target, direction)
        const outcomeR = mappedProfit ?? calculatedProfit

        if ((hasProvidedDateValue && !parsedDateAndTime.date) || !asset || outcomeR === null) {
          const reasons: string[] = []
          if (hasProvidedDateValue && !parsedDateAndTime.date) reasons.push('invalid trade date')
          if (!asset) reasons.push('missing asset')
          if (outcomeR === null) reasons.push('missing profit R (map column or provide entry/sl/target)')

          const sourceRowNumber = rowsToSkip + rowIndex + 1
          console.warn(`[ImportBacktesting] Skipping row ${sourceRowNumber}: ${reasons.join(', ')}`, { row })
          skipped += 1
          return
        }

        importableTrades.push({
          user_id: userId,
          session_id: sessionId,
          trade_date: tradeDate,
          trade_time: tradeTime,
          asset,
          direction,
          entry_price: entry,
          stop_loss: stopLoss,
          target_price: target,
          outcome_r: outcomeR,
          notes: getNullableText(getCell(row, mapping.notes)),
        })
      })

      if (importableTrades.length === 0) {
        setError('No valid rows found after mapping. Please verify your column mapping.')
        return
      }

      const existingTrades = await getBacktestingTrades(userId, sessionId)
      const existingSignatures = new Set(existingTrades.map(buildTradeSignatureFromExisting))
      const batchSignatures = new Set<string>()

      const newTrades: BacktestingTradeInsert[] = []
      let duplicatesExisting = 0
      let duplicatesInFile = 0

      importableTrades.forEach((trade) => {
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
        if (duplicatesExisting > 0) summaryParts.push(`Found ${duplicatesExisting} already existing rows.`)
        if (duplicatesInFile > 0) summaryParts.push(`Found ${duplicatesInFile} duplicate rows in file.`)
        if (ignored > 0) summaryParts.push(`Ignored ${ignored} non-data rows.`)
        if (skipped > 0) summaryParts.push(`Skipped ${skipped} invalid rows.`)
        setSummary(summaryParts.join(' '))
        return
      }

      await createBacktestingTradesBulk(newTrades)

      const summaryParts = [`Imported ${newTrades.length} backtesting trades.`]
      if (duplicatesExisting > 0) summaryParts.push(`Skipped ${duplicatesExisting} existing duplicates.`)
      if (duplicatesInFile > 0) summaryParts.push(`Skipped ${duplicatesInFile} file duplicates.`)
      if (ignored > 0) summaryParts.push(`Ignored ${ignored} non-data rows.`)
      if (skipped > 0) summaryParts.push(`Skipped ${skipped} invalid rows.`)
      setSummary(summaryParts.join(' '))

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import backtesting trades')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleImport} className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Import Backtesting Trades</h2>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
      </div>

      <p className="text-sm text-gray-600">Upload CSV/TSV/XLSX, map columns, preview values, and import in bulk.</p>

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
        <label className="block text-sm font-medium mb-1">Default Direction (if not mapped/detected)</label>
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
                      <th key={index} className="px-2 py-1 text-left border-r last:border-r-0">{toColumnLetter(index)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t">
                      {Array.from({ length: maxColumns }, (_, colIndex) => (
                        <td key={colIndex} className="px-2 py-1 border-r last:border-r-0 whitespace-nowrap">{row[colIndex] || '-'}</td>
                      ))}
                    </tr>
                  ))}
                  {previewRows.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(maxColumns, 1)} className="px-2 py-3 text-center text-gray-500">No preview rows available after skip.</td>
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

function buildTradeSignatureFromInsert(trade: BacktestingTradeInsert): string {
  return JSON.stringify([
    trade.trade_date,
    trade.trade_time,
    normalizeText(trade.asset),
    trade.direction,
    normalizeNumber(trade.entry_price),
    normalizeNumber(trade.stop_loss),
    normalizeNumber(trade.target_price),
    normalizeNumber(trade.outcome_r),
    normalizeText(trade.notes),
  ])
}

function buildTradeSignatureFromExisting(trade: BacktestingTrade): string {
  return JSON.stringify([
    trade.trade_date,
    trade.trade_time,
    normalizeText(trade.asset),
    trade.direction,
    normalizeNumber(trade.entry_price),
    normalizeNumber(trade.stop_loss),
    normalizeNumber(trade.target_price),
    normalizeNumber(trade.outcome_r),
    normalizeText(trade.notes),
  ])
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

function shouldIgnoreNonDataRow(row: string[], mapping: ColumnMapping): boolean {
  const requiredCells = [
    getCell(row, mapping.asset).trim(),
  ]

  return requiredCells.every((value) => value === '')
}

function detectDirection(entry: number | null, stopLoss: number | null): Direction | null {
  if (entry === null || stopLoss === null) return null
  if (entry > 0 && stopLoss > 0) {
    return entry > stopLoss ? 'long' : 'short'
  }
  return null
}

function calculateOutcomeR(
  entry: number | null,
  stopLoss: number | null,
  target: number | null,
  direction: Direction,
): number | null {
  if (entry === null || stopLoss === null || target === null) return null

  if (direction === 'long') {
    const risk = entry - stopLoss
    if (risk <= 0) return null
    return (target - entry) / risk
  }

  const risk = stopLoss - entry
  if (risk <= 0) return null
  return (entry - target) / risk
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

function parseDateAndOptionalTime(value: string): { date: string | null; time: string | null } {
  const trimmed = value.trim()
  if (!trimmed) return { date: null, time: null }

  const timeFromSameCell = parseTimeValue(trimmed)

  const firstToken = trimmed.split(/\s+/)[0] ?? ''
  const parsedFromFirstToken = parseDateValue(firstToken)
  if (parsedFromFirstToken) {
    return { date: parsedFromFirstToken, time: timeFromSameCell }
  }

  const parsedDate = parseDateValue(trimmed)
  if (parsedDate) {
    return { date: parsedDate, time: timeFromSameCell }
  }

  const weekdayMatch = trimmed.match(/^(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b[\s,\-]*(.*)$/i)
  if (weekdayMatch) {
    const weekdayToken = weekdayMatch[1]
    const remaining = weekdayMatch[2]?.trim() ?? ''
    const resolvedDate = resolveWeekdayToMostRecentDate(weekdayToken)
    const resolvedTime = remaining ? parseTimeValue(remaining) : null
    return {
      date: resolvedDate ? formatDate(resolvedDate) : null,
      time: resolvedTime,
    }
  }

  const combinedDateTime = new Date(trimmed)
  if (!Number.isNaN(combinedDateTime.getTime())) {
    return {
      date: formatDate(combinedDateTime),
      time: `${`${combinedDateTime.getHours()}`.padStart(2, '0')}:${`${combinedDateTime.getMinutes()}`.padStart(2, '0')}:${`${combinedDateTime.getSeconds()}`.padStart(2, '0')}`,
    }
  }

  return { date: null, time: null }
}

function resolveWeekdayToMostRecentDate(weekdayToken: string): Date | null {
  const normalized = weekdayToken.trim().toLowerCase()
  const weekdayMap: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  }

  const targetDay = weekdayMap[normalized]
  if (targetDay === undefined) return null

  const now = new Date()
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayDay = result.getDay()
  const diff = (todayDay - targetDay + 7) % 7
  result.setDate(result.getDate() - diff)
  return result
}

function parseTimeValue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

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

  const time24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (time24) {
    const hours = Number(time24[1])
    const minutes = Number(time24[2])
    const seconds = Number(time24[3] ?? '0')
    if (hours < 0 || hours > 23 || minutes > 59 || seconds > 59) return null
    return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`
  }

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

  const hasTimeHint = /:\d{2}/.test(trimmed) || /[AaPp][Mm]/.test(trimmed)
  if (!hasTimeHint) return null

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

function getTodayDateString(): string {
  const now = new Date()
  return formatDate(now)
}
