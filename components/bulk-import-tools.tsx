import {
  bulkImportSchedules,
  bulkImportStudents,
} from "@/hooks/api/students"
import { bulkImportVocabulary } from "@/hooks/api/content"
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  AlertTriangle,
  Eye,
  Save,
  RotateCcw,
  FileSpreadsheet,
  Database,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DataTable } from "@/components/data-table"

interface BulkImportToolsProps {
  onImportComplete?: (data: ImportedData) => void
  deckId?: string
}

interface ImportedData {
  type: "vocabulary" | "students" | "schedules"
  items: any[]
  errors: ImportError[]
  summary: ImportSummary
}

interface ImportError {
  row: number
  field: string
  message: string
  severity: "error" | "warning"
}

interface ImportSummary {
  totalRows: number
  successfulRows: number
  errorRows: number
  warningRows: number
}

interface VocabularyCard {
  englishWord: string
  chineseTranslation: string
  pinyin?: string
  ipaPronunciation?: string
  wordType?: string
  difficultyLevel: number
  tags?: string[]
  audioUrl?: string
  imageUrl?: string
  exampleSentences?: string
}

interface StudentData {
  name: string
  email: string
  phone?: string
  notes?: string
  initialDeckId?: string
}

const importTemplates = {
  vocabulary: {
    name: "Vocabulary Cards",
    description: "Import vocabulary cards with translations and metadata",
    requiredFields: ["englishWord", "chineseTranslation"],
    optionalFields: [
      "pinyin",
      "ipaPronunciation",
      "wordType",
      "difficultyLevel",
      "tags",
      "audioUrl",
      "imageUrl",
      "exampleSentences",
    ],
    sampleData: [
      {
        englishWord: "hello",
        chineseTranslation: "你好",
        pinyin: "nǐ hǎo",
        ipaPronunciation: "/həˈloʊ/",
        wordType: "interjection",
        difficultyLevel: 1,
        tags: "greeting,basic",
        audioUrl: "https://example.com/hello.mp3",
        imageUrl: "https://example.com/hello.jpg",
        exampleSentences: '{"english": "Hello, how are you?", "chinese": "你好，你好吗？"}',
      },
      {
        englishWord: "goodbye",
        chineseTranslation: "再见",
        pinyin: "zài jiàn",
        ipaPronunciation: "/ɡʊdˈbaɪ/",
        wordType: "interjection",
        difficultyLevel: 1,
        tags: "greeting,basic",
        audioUrl: "",
        imageUrl: "",
        exampleSentences: '{"english": "Goodbye, see you later!", "chinese": "再见，回头见！"}',
      },
    ],
  },
  students: {
    name: "Student Information",
    description: "Import student profiles and contact information",
    requiredFields: ["name", "email"],
    optionalFields: ["phone", "notes", "initialDeckId"],
    sampleData: [
      {
        name: "Alice Wang",
        email: "alice.wang@example.com",
        phone: "+1-555-0123",
        notes: "Beginner level, prefers visual learning",
        initialDeckId: "deck-basic-english",
      },
      {
        name: "Bob Chen",
        email: "bob.chen@example.com",
        phone: "+1-555-0124",
        notes: "Intermediate level, business focus",
        initialDeckId: "deck-business-english",
      },
    ],
  },
  schedules: {
    name: "Class Schedules",
    description: "Import class schedules and appointments",
    requiredFields: ["studentEmail", "scheduledTime"],
    optionalFields: ["duration", "notes", "type"],
    sampleData: [
      {
        studentEmail: "alice.wang@example.com",
        scheduledTime: "2024-02-01T14:00:00Z",
        duration: 60,
        notes: "Regular conversation practice",
        type: "vocabulary",
      },
      {
        studentEmail: "bob.chen@example.com",
        scheduledTime: "2024-02-01T16:00:00Z",
        duration: 90,
        notes: "Business presentation practice",
        type: "speaking",
      },
    ],
  },
}

export function BulkImportTools({ onImportComplete, deckId }: BulkImportToolsProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof importTemplates>("vocabulary")
  const [importedData, setImportedData] = useState<ImportedData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [errors, setErrors] = useState<ImportError[]>([])
  const [csvText, setCsvText] = useState("")
  const [fileName, setFileName] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsvText(text)
      parseCSV(text)
    }

    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      reader.readAsText(file)
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      })
    }
  }

  const parseCSV = (text: string) => {
    try {
      const lines = text.trim().split("\n")
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row")
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
      const template = importTemplates[selectedTemplate]
      const newErrors: ImportError[] = []
      const parsedData: any[] = []

      // Validate headers
      const missingRequired = template.requiredFields.filter((field) => !headers.includes(field))
      if (missingRequired.length > 0) {
        newErrors.push({
          row: 0,
          field: missingRequired.join(", "),
          message: `Missing required columns: ${missingRequired.join(", ")}`,
          severity: "error",
        })
      }

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""))
        const rowData: any = {}

        headers.forEach((header, index) => {
          rowData[header] = values[index] || ""
        })

        // Validate required fields
        template.requiredFields.forEach((field) => {
          if (!rowData[field] || rowData[field].trim() === "") {
            newErrors.push({
              row: i,
              field,
              message: `Required field '${field}' is empty`,
              severity: "error",
            })
          }
        })

        // Type-specific validations
        if (selectedTemplate === "vocabulary") {
          if (
            rowData.difficultyLevel &&
            (isNaN(Number(rowData.difficultyLevel)) ||
              Number(rowData.difficultyLevel) < 1 ||
              Number(rowData.difficultyLevel) > 5)
          ) {
            newErrors.push({
              row: i,
              field: "difficultyLevel",
              message: "Difficulty level must be a number between 1 and 5",
              severity: "error",
            })
          }
        } else if (selectedTemplate === "students") {
          if (rowData.email && !rowData.email.includes("@")) {
            newErrors.push({
              row: i,
              field: "email",
              message: "Invalid email format",
              severity: "error",
            })
          }
        }

        parsedData.push(rowData)
      }

      setPreviewData(parsedData.slice(0, 10)) // Show first 10 rows for preview
      setErrors(newErrors)

      toast({
        title: "File parsed successfully",
        description: `Found ${parsedData.length} rows with ${newErrors.filter((e) => e.severity === "error").length} errors`,
      })
    } catch (error) {
      toast({
        title: "Parse error",
        description: "Failed to parse CSV file. Please check the format.",
        variant: "destructive",
      })
    }
  }

  const processImport = async () => {
    if (errors.filter((e) => e.severity === "error").length > 0) {
      toast({
        title: "Cannot import",
        description: "Please fix all errors before importing.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      let job;
      switch (selectedTemplate) {
        case "vocabulary":
          if (!deckId) {
            toast({
              title: "Cannot import vocabulary",
              description: "No deck selected.",
              variant: "destructive",
            });
            setIsProcessing(false);
            return;
          }
          job = await bulkImportVocabulary(deckId, previewData);
          break;
        case "students":
          job = await bulkImportStudents(previewData);
          break;
        case "schedules":
          job = await bulkImportSchedules(previewData);
          break;
        default:
          throw new Error("Invalid template selected");
      }

      toast({
        title: "Import job started",
        description: `Job ${job.data.id} has been created and is now processing.`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: "An error occurred during import. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = importTemplates[selectedTemplate]
    const headers = [...template.requiredFields, ...template.optionalFields]
    const csvContent = [
      headers.join(","),
      ...template.sampleData.map((row) =>
        headers
          .map((header) => {
            const value = (row as any)[header] || ""
            return typeof value === "string" && value.includes(",") ? `"${value}"` : value
          })
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${selectedTemplate}_template.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Template downloaded",
      description: "Use this template to format your data correctly.",
    })
  }

  const resetImport = () => {
    setImportedData(null)
    setPreviewData([])
    setErrors([])
    setCsvText("")
    setFileName("")
    setProcessingProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const errorColumns = [
    {
      key: "row",
      header: "Row",
      render: (value: number) => <Badge variant="outline">Row {value}</Badge>,
    },
    {
      key: "field",
      header: "Field",
      render: (value: string) => <code className="text-sm bg-slate-100 px-1 rounded">{value}</code>,
    },
    {
      key: "message",
      header: "Message",
    },
    {
      key: "severity",
      header: "Severity",
      render: (value: string) => <Badge variant={value === "error" ? "destructive" : "secondary"}>{value}</Badge>,
    },
  ]

  const previewColumns =
    selectedTemplate === "vocabulary"
      ? [
        { key: "englishWord", header: "English Word" },
        { key: "chineseTranslation", header: "Chinese Translation" },
        { key: "pinyin", header: "Pinyin" },
        { key: "wordType", header: "Word Type" },
        { key: "difficultyLevel", header: "Difficulty" },
      ]
      : selectedTemplate === "students"
        ? [
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          { key: "phone", header: "Phone" },
          { key: "notes", header: "Notes" },
        ]
        : [
          { key: "studentEmail", header: "Student Email" },
          { key: "scheduledTime", header: "Scheduled Time" },
          { key: "duration", header: "Duration" },
          { key: "type", header: "Type" },
        ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Bulk Import Tools</h2>
          <p className="text-slate-600">Import data from CSV files with validation and error checking</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <Button variant="outline" onClick={resetImport}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <Tabs defaultValue="import" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import">Import Data</TabsTrigger>
          <TabsTrigger value="preview">Preview & Validate</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Select Import Type</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(importTemplates).map(([key, template]) => (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-colors ${selectedTemplate === key ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    onClick={() => setSelectedTemplate(key as keyof typeof importTemplates)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium">{template.name}</h3>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs font-medium text-slate-500">Required:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.requiredFields.map((field) => (
                              <Badge key={field} variant="destructive" className="text-xs">
                                {field}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500">Optional:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.optionalFields.slice(0, 3).map((field) => (
                              <Badge key={field} variant="outline" className="text-xs">
                                {field}
                              </Badge>
                            ))}
                            {template.optionalFields.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{template.optionalFields.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Upload CSV File</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-slate-900">{fileName || "Choose a CSV file to upload"}</h3>
                  <p className="text-slate-500">Upload a CSV file formatted according to the selected template</p>
                </div>
                <div className="mt-4">
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              </div>

              {/* Manual CSV Input */}
              <div className="space-y-2">
                <Label htmlFor="csvText">Or paste CSV data directly:</Label>
                <Textarea
                  id="csvText"
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value)
                    if (e.target.value.trim()) {
                      parseCSV(e.target.value)
                    }
                  }}
                  placeholder="Paste your CSV data here..."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          {previewData.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Eye className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Data to Preview</h3>
                <p className="text-slate-500">Upload a CSV file to see a preview of your data</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Validation Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5" />
                    <span>Validation Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900">{previewData.length}</div>
                      <div className="text-sm text-slate-600">Total Rows</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {previewData.length - errors.filter((e) => e.severity === "error").length}
                      </div>
                      <div className="text-sm text-slate-600">Valid Rows</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {errors.filter((e) => e.severity === "error").length}
                      </div>
                      <div className="text-sm text-slate-600">Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {errors.filter((e) => e.severity === "warning").length}
                      </div>
                      <div className="text-sm text-slate-600">Warnings</div>
                    </div>
                  </div>

                  {errors.filter((e) => e.severity === "error").length === 0 && (
                    <div className="mt-4 text-center">
                      <Button
                        onClick={processImport}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isProcessing ? "Processing..." : "Import Data"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Processing Progress */}
              {isProcessing && (
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Processing import...</span>
                        <span className="text-sm text-slate-500">{Math.round(processingProgress)}%</span>
                      </div>
                      <Progress value={processingProgress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Errors Table */}
              {errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span>Validation Errors</span>
                      <Badge variant="destructive">{errors.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable data={errors} columns={errorColumns} pageSize={10} />
                  </CardContent>
                </Card>
              )}

              {/* Data Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye className="h-5 w-5" />
                    <span>Data Preview</span>
                    <Badge variant="outline">First 10 rows</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable data={previewData} columns={previewColumns} pageSize={10} searchable={false} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {importedData ? (
            <>
              {/* Import Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span>Import Complete</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold text-slate-900">{importedData.summary.totalRows}</div>
                      <div className="text-sm text-slate-600">Total Processed</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{importedData.summary.successfulRows}</div>
                      <div className="text-sm text-slate-600">Successful</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{importedData.summary.errorRows}</div>
                      <div className="text-sm text-slate-600">Errors</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{importedData.summary.warningRows}</div>
                      <div className="text-sm text-slate-600">Warnings</div>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="flex items-center justify-center space-x-4">
                    <Button onClick={resetImport} variant="outline">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Import More Data
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Eye className="h-4 w-4 mr-2" />
                      View Imported Items
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Import Details */}
              {importedData.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Import Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable data={importedData.errors} columns={errorColumns} pageSize={10} />
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Database className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Import Results</h3>
                <p className="text-slate-500">Complete an import to see the results here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
