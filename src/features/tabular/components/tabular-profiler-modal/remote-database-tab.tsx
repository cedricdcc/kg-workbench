"use client"

import { useState, useMemo } from "react"
import {
  Database,
  Search,
  Loader2,
  Table2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  Server,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type {
  RemoteDbConnectionConfig,
  RemoteDbConnectionInput,
  TableDiscoveryItem,
} from "../../server/actions/remote-database"
import type { TabularProfileResult } from "../../types"

export interface RemoteDatabaseTabProps {
  ontologyId: string
  onProfileComplete: (
    result: TabularProfileResult,
    connectionConfig?: RemoteDbConnectionConfig
  ) => void
  initialStep?: 1 | 2
  initialTables?: TableDiscoveryItem[]
  initialConnection?: Partial<RemoteDbConnectionInput>
}

export function RemoteDatabaseTab({
  ontologyId,
  onProfileComplete,
  initialStep = 1,
  initialTables = [],
  initialConnection,
}: RemoteDatabaseTabProps) {
  const [step, setStep] = useState<1 | 2>(initialStep)

  // Step 1: Connection Form State
  const [dbType, setDbType] = useState<"postgres" | "mysql">(
    initialConnection?.dbType ?? "postgres"
  )
  const [host, setHost] = useState(initialConnection?.host ?? "localhost")
  const [port, setPort] = useState(
    initialConnection?.port?.toString() ??
      (initialConnection?.dbType === "mysql" ? "3306" : "5432")
  )
  const [database, setDatabase] = useState(initialConnection?.database ?? "")
  const [user, setUser] = useState(initialConnection?.user ?? "")
  const [password, setPassword] = useState(initialConnection?.password ?? "")
  const [sslMode, setSslMode] = useState<"prefer" | "disable" | "require">(
    initialConnection?.sslMode ?? "prefer"
  )

  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)

  // Step 2: Table Picker State
  const [tables, setTables] = useState<TableDiscoveryItem[]>(initialTables)
  const [selectedTable, setSelectedTable] = useState<TableDiscoveryItem | null>(
    initialTables[0] ?? null
  )
  const [tableSearch, setTableSearch] = useState("")
  const [isProfiling, setIsProfiling] = useState(false)
  const [profilingError, setProfilingError] = useState<string | null>(null)

  const handleEngineChange = (val: "postgres" | "mysql") => {
    setDbType(val)
    if (val === "mysql" && port === "5432") {
      setPort("3306")
    } else if (val === "postgres" && port === "3306") {
      setPort("5432")
    }
  }

  const handleConnectAndDiscover = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setDiscoveryError(null)

    if (!host.trim() || !database.trim() || !user.trim()) {
      setDiscoveryError("Host, Database name, and Username are required.")
      return
    }

    const parsedPort = parseInt(port, 10)
    if (isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      setDiscoveryError("Please specify a valid port number (1-65535).")
      return
    }

    setIsDiscovering(true)
    try {
      const { discoverRemoteTablesAction } =
        await import("../../server/actions/remote-database")
      const res = await discoverRemoteTablesAction({
        dbType,
        host: host.trim(),
        port: parsedPort,
        database: database.trim(),
        user: user.trim(),
        password,
        sslMode,
        ontologyId,
      })

      if (res.success) {
        setTables(res.tables)
        if (res.tables.length > 0) {
          setSelectedTable(res.tables[0])
        }
        setStep(2)
        toast.success(`Discovered ${res.tables.length} tables/views`)
      } else {
        setDiscoveryError(res.error || "Failed to discover database tables.")
        toast.error(res.error || "Database connection failed")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setDiscoveryError(msg)
      toast.error(msg)
    } finally {
      setIsDiscovering(false)
    }
  }

  const filteredTables = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    if (!q) return tables
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.schema.toLowerCase().includes(q)
    )
  }, [tables, tableSearch])

  const handleProfileSelectedTable = async () => {
    if (!selectedTable) {
      setProfilingError("Please select a table to profile.")
      return
    }

    setProfilingError(null)
    setIsProfiling(true)

    const parsedPort = parseInt(port, 10) || (dbType === "mysql" ? 3306 : 5432)

    try {
      const { profileRemoteTableAction } =
        await import("../../server/actions/remote-database")
      const res = await profileRemoteTableAction({
        dbType,
        host: host.trim(),
        port: parsedPort,
        database: database.trim(),
        user: user.trim(),
        password,
        sslMode,
        ontologyId,
        schema: selectedTable.schema,
        table: selectedTable.name,
      })

      if (res.success) {
        toast.success(`Successfully profiled "${selectedTable.name}"`)
        onProfileComplete(res.profile, res.connectionConfig)
      } else {
        setProfilingError(res.error || "Failed to profile remote table.")
        toast.error(res.error || "Remote profiling failed")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setProfilingError(msg)
      toast.error(msg)
    } finally {
      setIsProfiling(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Step Indicator Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            {step === 1
              ? "Step 1: Database Connection"
              : "Step 2: Table Selection"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Badge
            variant={step === 1 ? "default" : "secondary"}
            className="h-5 px-1.5 text-[10px]"
          >
            1. Connect
          </Badge>
          <span>→</span>
          <Badge
            variant={step === 2 ? "default" : "secondary"}
            className="h-5 px-1.5 text-[10px]"
          >
            2. Select & Profile
          </Badge>
        </div>
      </div>

      {step === 1 ? (
        /* STEP 1: Connection Form */
        <form onSubmit={handleConnectAndDiscover} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Database Engine */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Database Engine</Label>
              <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/40 p-0.5">
                <Button
                  type="button"
                  variant={dbType === "postgres" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleEngineChange("postgres")}
                >
                  PostgreSQL
                </Button>
                <Button
                  type="button"
                  variant={dbType === "mysql" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleEngineChange("mysql")}
                >
                  MySQL
                </Button>
              </div>
            </div>

            {/* SSL Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">SSL Mode</Label>
              <Select
                value={sslMode}
                onValueChange={(v) =>
                  setSslMode(v as "prefer" | "disable" | "require")
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="SSL Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prefer">Prefer SSL</SelectItem>
                  <SelectItem value="require">Require SSL</SelectItem>
                  <SelectItem value="disable">Disable SSL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="db-host" className="text-xs font-medium">
                Host
              </Label>
              <Input
                id="db-host"
                placeholder="e.g. localhost or db.example.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="h-8 font-mono text-xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="db-port" className="text-xs font-medium">
                Port
              </Label>
              <Input
                id="db-port"
                type="number"
                placeholder={dbType === "mysql" ? "3306" : "5432"}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="h-8 font-mono text-xs"
                required
              />
            </div>
          </div>

          {/* Database Name */}
          <div className="space-y-1.5">
            <Label htmlFor="db-database" className="text-xs font-medium">
              Database Name
            </Label>
            <Input
              id="db-database"
              placeholder="e.g. production_db"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              className="h-8 font-mono text-xs"
              required
            />
          </div>

          {/* Username & Password */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="db-user" className="text-xs font-medium">
                Username
              </Label>
              <Input
                id="db-user"
                placeholder="e.g. postgres or root"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="h-8 font-mono text-xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="db-password" className="text-xs font-medium">
                Password
              </Label>
              <Input
                id="db-password"
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>

          {/* Error Notice */}
          {discoveryError && (
            <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{discoveryError}</span>
            </div>
          )}

          {/* Connect & Discover Button */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Server className="h-3.5 w-3.5" />
              <span>Read-only inspection via DuckDB SQL scanner</span>
            </div>
            <Button
              type="submit"
              disabled={isDiscovering}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              {isDiscovering ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Database className="h-3.5 w-3.5" />
                  Connect & Discover Tables
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        /* STEP 2: Table Selection */
        <div className="space-y-3">
          {/* Connection Summary Pill */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 font-mono">
              <Badge variant="outline" className="text-[10px] uppercase">
                {dbType}
              </Badge>
              <span className="text-muted-foreground">
                {user}@{host}:{port}/{database}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={() => {
                setStep(1)
                setProfilingError(null)
              }}
            >
              <ArrowLeft className="h-3 w-3" />
              Change Connection
            </Button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tables and views..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Table List / Combobox */}
          <div className="rounded-md border">
            <ScrollArea className="h-56">
              {filteredTables.length > 0 ? (
                <div className="divide-y text-xs">
                  {filteredTables.map((t) => {
                    const isSelected =
                      selectedTable?.schema === t.schema &&
                      selectedTable?.name === t.name
                    return (
                      <div
                        key={`${t.schema}.${t.name}`}
                        onClick={() => setSelectedTable(t)}
                        className={`flex cursor-pointer items-center justify-between p-2.5 transition-colors hover:bg-muted/50 ${
                          isSelected ? "bg-primary/10 font-medium" : ""
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="truncate">
                            <span className="text-foreground">{t.name}</span>
                            <span className="ml-1.5 text-[11px] text-muted-foreground">
                              ({t.schema})
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="font-mono text-[9px] uppercase"
                          >
                            {t.type}
                          </Badge>
                          {t.estimatedRows !== undefined && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {t.estimatedRows.toLocaleString()} rows
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {tableSearch
                    ? "No tables or views match search query."
                    : "No tables found in this database."}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Profiling Error Notice */}
          {profilingError && (
            <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{profilingError}</span>
            </div>
          )}

          {/* Profile Table Button */}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-[11px] text-muted-foreground">
              {selectedTable ? (
                <span>
                  Selected:{" "}
                  <code className="font-semibold text-foreground">
                    {selectedTable.schema}.{selectedTable.name}
                  </code>
                </span>
              ) : (
                <span>Select a table to profile</span>
              )}
            </div>

            <Button
              onClick={handleProfileSelectedTable}
              disabled={!selectedTable || isProfiling}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              {isProfiling ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Profiling Table...
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Profile Table
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
