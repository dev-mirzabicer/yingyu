"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  bulkImportSchedules,
  bulkImportStudents,
} from "@/hooks/api/students";
import { bulkImportVocabulary, bulkImportFillInTheBlankCards, bulkImportGenericCards } from "@/hooks/api/content";
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
  XCircle,
  FileClock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type Column } from "@/components/data-table";
import { JobStatusIndicator } from "@/components/ui/job-status-indicator";
import { Job } from "@prisma/client";
import { BulkImportResult, BulkImportError } from "@/lib/types";
import { BulkImportResultSchema } from "@/lib/schemas/jobs";

interface BulkImportToolsProps {
  type?: 'vocabulary' | 'students' | 'schedules' | 'fill-in-the-blank' | 'generic-deck';
  deckId?: string;
  onComplete?: () => void;
}

// Note: Local validation types are kept for the initial parsing step.
// The final result from the job will use the official `BulkImportResult` types.
interface ImportError {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
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
      },
    ],
  },
  "fill-in-the-blank": {
    name: "Fill in the Blank Cards",
    description: "Import questions, answers, and optional choices",
    requiredFields: ["question", "answer"],
    optionalFields: ["options", "explanation"],
    sampleData: [
      {
        question: "The sky is ____.",
        answer: "blue",
        options: "blue,red,green,yellow",
        explanation: "The sky appears blue due to light scattering.",
      },
    ],
  },
  "generic-deck": {
    name: "Generic Deck Cards",
    description: "Import generic cards with front/back content",
    requiredFields: ["front", "back"],
    optionalFields: ["exampleSentences"],
    sampleData: [
      {
        front: "Hello",
        back: "A greeting used when meeting someone",
        exampleSentences: "Hello, how are you today?",
      },
    ],
  },
};

export function BulkImportTools({ type = "vocabulary", deckId, onComplete }: BulkImportToolsProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof importTemplates>(type);
  const [jobId, setJobId] = useState<string | null>(null);
  const [importedData, setImportedData] = useState<BulkImportResult | null>(
    null
  );
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [activeTab, setActiveTab] = useState("import");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      parseCSV(text);
      setActiveTab("preview");
    };

    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
    }
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.trim().split("\n");
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
      const template = importTemplates[selectedTemplate];
      const newErrors: ImportError[] = [];
      const parsedData: any[] = [];

      const missingRequired = template.requiredFields.filter(
        (field) => !headers.includes(field)
      );
      if (missingRequired.length > 0) {
        newErrors.push({
          row: 0,
          field: missingRequired.join(", "),
          message: `Missing required columns: ${missingRequired.join(", ")}`,
          severity: "error",
        });
      }

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
        const rowData: any = {};

        headers.forEach((header, index) => {
          rowData[header] = values[index] || "";
        });

        template.requiredFields.forEach((field) => {
          if (!rowData[field] || rowData[field].trim() === "") {
            newErrors.push({
              row: i,
              field,
              message: `Required field '${field}' is empty`,
              severity: "error",
            });
          }
        });

        parsedData.push(rowData);
      }

      setPreviewData(parsedData.slice(0, 10));
      setErrors(newErrors);

      toast({
        title: "File parsed successfully",
        description: `Found ${ 
          parsedData.length
        } rows with ${newErrors.filter((e) => e.severity === "error").length} errors`,
      });
    } catch (error) {
      toast({
        title: "Parse error",
        description: "Failed to parse CSV file. Please check the format.",
        variant: "destructive",
      });
    }
  };

  const processImport = async () => {
    if (errors.filter((e) => e.severity === "error").length > 0) {
      toast({
        title: "Cannot import",
        description: "Please fix all errors before importing.",
        variant: "destructive",
      });
      return;
    }

    try {
      let response;
      switch (selectedTemplate) {
        case "vocabulary":
          if (!deckId) {
            toast({
              title: "Cannot import vocabulary",
              description: "No deck selected.",
              variant: "destructive",
            });
            return;
          }
          response = await bulkImportVocabulary(deckId, previewData);
          break;
        case "students":
          response = await bulkImportStudents(previewData);
          break;
        case "schedules":
          response = await bulkImportSchedules(previewData);
          break;
        case "fill-in-the-blank":
          if (!deckId) {
            toast({
              title: "Cannot import fill-in-the-blank cards",
              description: "No deck selected.",
              variant: "destructive",
            });
            return;
          }
          response = await bulkImportFillInTheBlankCards(deckId, previewData);
          break;
        case "generic-deck":
          if (!deckId) {
            toast({
              title: "Cannot import generic deck cards",
              description: "No deck selected.",
              variant: "destructive",
            });
            return;
          }
          response = await bulkImportGenericCards(deckId, previewData);
          break;
        default:
          throw new Error("Invalid template selected");
      }

      const job = response.data;
      setJobId(job.id);
      toast({
        title: "Import job started",
        description: `Job ${job.id} has been created and is now processing.`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: "An error occurred during import. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleJobComplete = (job: Job) => {
    const result = BulkImportResultSchema.safeParse(job.result);

    if (result.success) {
      setImportedData(result.data);
      setActiveTab("results");
      toast({
        title: "Import Complete",
        description: `Processed ${result.data.summary.totalRows} rows.`,
      });
    } else {
      setImportedData(null);
      setActiveTab("results");
      toast({
        title: "Error Processing Results",
        description:
          "The job completed, but the results format was unexpected. Please check the job logs.",
        variant: "destructive",
      });
      console.error("Failed to parse job result:", result.error);
    }
  };

  const downloadTemplate = () => {
    const template = importTemplates[selectedTemplate];
    const headers = [...template.requiredFields, ...template.optionalFields];
    const csvContent = [
      headers.join(","),
      ...template.sampleData.map((row) =>
        headers
          .map((header) => {
            const value = (row as any)[header] || "";
            return typeof value === "string" && value.includes(",")
              ? `"${value}"`
              : value;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Template downloaded",
      description: "Use this template to format your data correctly.",
    });
  };

  const resetImport = () => {
    setJobId(null);
    setImportedData(null);
    setPreviewData([]);
    setErrors([]);
    setCsvText("");
    setFileName("");
    setActiveTab("import");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resultErrorColumns: Column<BulkImportError>[] = [
    {
      key: "rowNumber",
      header: "Row",
      render: (value, row) => (
        <Badge variant="outline">Row {row.rowNumber}</Badge>
      ),
    },
    {
      key: "fieldName",
      header: "Field",
      render: (value, row) => (
        <code className="text-sm bg-slate-100 px-1 rounded">
          {row.fieldName}
        </code>
      ),
    },
    {
      key: "errorMessage",
      header: "Message",
      render: (value, row) => row.errorMessage,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Bulk Import Tools
          </h2>
          <p className="text-slate-600">
            Import data from CSV files with validation and error checking
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <Button variant="destructive" onClick={resetImport}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import">1. Import Data</TabsTrigger>
          <TabsTrigger value="preview" disabled={previewData.length === 0}>
            2. Preview & Validate
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!jobId}>
            3. Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
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
                    className={`cursor-pointer transition-colors ${ 
                      selectedTemplate === key
                        ? "ring-2 ring-blue-500 bg-blue-50"
                        : "hover:bg-slate-50"
                    }`}
                    onClick={() =>
                      setSelectedTemplate(key as keyof typeof importTemplates)
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium">{template.name}</h3>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">
                        {template.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

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
                  <h3 className="text-lg font-medium text-slate-900">
                    {fileName || "Choose a CSV file to upload"}
                  </h3>
                  <p className="text-slate-500">
                    Upload a CSV file formatted according to the selected
                    template
                  </p>
                </div>
                <div className="mt-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csvText">Or paste CSV data directly:</Label>
                <Textarea
                  id="csvText"
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    if (e.target.value.trim()) {
                      parseCSV(e.target.value);
                      setActiveTab("preview");
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
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  No Data to Preview
                </h3>
                <p className="text-slate-500">
                  Upload a CSV file to see a preview of your data
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5" />
                    <span>Validation Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900">
                        {previewData.length}
                      </div>
                      <div className="text-sm text-slate-600">Total Rows</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {
                          previewData.length -
                          errors.filter((e) => e.severity === "error").length
                        }
                      </div>
                      <div className="text-sm text-slate-600">Valid Rows</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {errors.filter((e) => e.severity === "error").length}
                      </div>
                      <div className="text-sm text-slate-600">Errors</div>
                    </div>
                  </div>

                  {errors.filter((e) => e.severity === "error").length ===
                    0 && (
                    <div className="mt-4 text-center">
                      <Button
                        onClick={processImport}
                        disabled={!!jobId || errors.some(e => e.severity === 'error')}
                        className="w-full"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {jobId ? "Processing..." : "Confirm and Start Import"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {jobId && (
                <JobStatusIndicator
                  jobId={jobId}
                  title="Bulk Import"
                  description="The system is processing your data. This may take a few minutes."
                  onComplete={handleJobComplete}
                />
              )}

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
                    <DataTable
                      data={errors}
                      columns={[
                        {
                          key: "row",
                          header: "Row",
                          render: (value, row) => (
                            <Badge variant="outline">Row {row.row}</Badge>
                          ),
                        },
                        {
                          key: "field",
                          header: "Field",
                          render: (value, row) => (
                            <code className="text-sm bg-slate-100 px-1 rounded">
                              {row.field}
                            </code>
                          ),
                        },
                        {
                          key: "message",
                          header: "Message",
                          render: (value, row) => row.message,
                        },
                        {
                          key: "severity",
                          header: "Severity",
                          render: (value, row) => (
                            <Badge
                              variant={row.severity === "error" ? "destructive" : "secondary"}
                            >
                              {row.severity}
                            </Badge>
                          ),
                        },
                      ]}
                      pageSize={10}
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye className="h-5 w-5" />
                    <span>Data Preview</span>
                    <Badge variant="outline">First 10 rows</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable
                    data={previewData}
                    columns={[
                      { key: "englishWord", header: "English Word" },
                      { key: "chineseTranslation", header: "Chinese Translation" },
                      { key: "pinyin", header: "Pinyin" },
                      { key: "wordType", header: "Word Type" },
                      { key: "difficultyLevel", header: "Difficulty" },
                    ]}
                    pageSize={10}
                    searchable={false}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {importedData ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span>Import Complete</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <Card className="p-4 bg-green-50">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-slate-900">
                        {importedData.summary.successfulImports}
                      </div>
                      <div className="text-sm text-slate-600">
                        Successful Rows
                      </div>
                    </Card>
                    <Card className="p-4 bg-red-50">
                      <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-red-600">
                        {importedData.summary.failedImports}
                      </div>
                      <div className="text-sm text-slate-600">Failed Rows</div>
                    </Card>
                    <Card className="p-4 bg-slate-50">
                      <FileClock className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-slate-900">
                        {importedData.summary.totalRows}
                      </div>
                      <div className="text-sm text-slate-600">Total Rows</div>
                    </Card>
                  </div>

                  <Separator className="my-6" />

                  <div className="flex items-center justify-center space-x-4">
                    <Button onClick={resetImport} variant="outline">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Start New Import
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {importedData.errors && importedData.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <span>Import Errors</span>
                      <Badge variant="destructive">
                        {importedData.errors.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Database className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  No Import Results
                </h3>
                <p className="text-slate-500">
                  Complete an import to see the results here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
