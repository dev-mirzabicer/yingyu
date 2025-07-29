"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DollarSign,
  CalendarIcon,
  Plus,
  TrendingUp,
  AlertTriangle,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { recordPayment } from "@/hooks/use-api-enhanced"
import type { FullStudentProfile } from "@/lib/types"
import type { Payment } from "@prisma/client"
import { DataTable } from "@/components/data-table"

interface PaymentManagerProps {
  student: FullStudentProfile
  onPaymentRecorded: () => void
}

interface PaymentFormData {
  amount: string
  classesPurchased: string
  paymentDate: Date
  paymentMethod: string
  notes: string
}

const paymentMethods = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Credit/Debit Card", icon: CreditCard },
  { value: "bank_transfer", label: "Bank Transfer", icon: Receipt },
  { value: "mobile_payment", label: "Mobile Payment", icon: Smartphone },
  { value: "other", label: "Other", icon: DollarSign },
]

const initialFormData: PaymentFormData = {
  amount: "",
  classesPurchased: "",
  paymentDate: new Date(),
  paymentMethod: "",
  notes: "",
}

export function PaymentManager({ student, onPaymentRecorded }: PaymentManagerProps) {
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)
  const [formData, setFormData] = useState<PaymentFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const { toast } = useToast()

  // Calculate payment statistics
  const totalPaid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const totalClassesPurchased = student.payments.reduce((sum, payment) => sum + payment.classesPurchased, 0)
  const totalClassesUsed = student.payments.reduce((sum, payment) => sum + payment.classesUsed, 0)
  const averageClassPrice = totalClassesPurchased > 0 ? totalPaid / totalClassesPurchased : 0
  const recentPayments = student.payments.slice(0, 5)

  const handleRecordPayment = async () => {
    if (!formData.amount || !formData.classesPurchased) {
      toast({
        title: "Error",
        description: "Please fill in amount and classes purchased.",
        variant: "destructive",
      })
      return
    }

    const amount = Number.parseFloat(formData.amount)
    const classes = Number.parseInt(formData.classesPurchased)

    if (amount <= 0 || classes <= 0) {
      toast({
        title: "Error",
        description: "Amount and classes must be greater than 0.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await recordPayment(student.id, {
        amount,
        classesPurchased: classes,
        paymentDate: formData.paymentDate.toISOString(),
      })

      toast({
        title: "Payment recorded successfully",
        description: `$${amount} for ${classes} classes has been recorded.`,
      })

      setFormData(initialFormData)
      setIsRecordPaymentOpen(false)
      onPaymentRecorded()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateClassPrice = () => {
    const amount = Number.parseFloat(formData.amount)
    const classes = Number.parseInt(formData.classesPurchased)
    if (amount > 0 && classes > 0) {
      return (amount / classes).toFixed(2)
    }
    return "0.00"
  }

  const paymentColumns = [
    {
      key: "paymentDate",
      header: "Date",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
    {
      key: "amount",
      header: "Amount",
      render: (value: number) => <div className="font-medium text-green-600">${value.toFixed(2)}</div>,
    },
    {
      key: "classesPurchased",
      header: "Classes",
      render: (value: number, row: Payment) => (
        <div className="space-y-1">
          <div className="font-medium">{value} purchased</div>
          <div className="text-sm text-slate-500">{row.classesUsed} used</div>
        </div>
      ),
    },
    {
      key: "pricePerClass",
      header: "Price/Class",
      render: (_: any, row: Payment) => (
        <div className="text-slate-600">${(Number(row.amount) / row.classesPurchased).toFixed(2)}</div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (_: any, row: Payment) => {
        const remaining = row.classesPurchased - row.classesUsed
        return (
          <Badge variant={remaining > 0 ? "default" : "secondary"}>
            {remaining > 0 ? `${remaining} remaining` : "Fully used"}
          </Badge>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Payment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total Paid</p>
                <p className="text-2xl font-bold text-slate-900">${totalPaid.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Classes Purchased</p>
                <p className="text-2xl font-bold text-slate-900">{totalClassesPurchased}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Classes Used</p>
                <p className="text-2xl font-bold text-slate-900">{totalClassesUsed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Avg Price/Class</p>
                <p className="text-2xl font-bold text-slate-900">${averageClassPrice.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Balance Alert */}
      {student.classesRemaining <= 2 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{student.name}</strong> has only {student.classesRemaining} classes remaining. Consider recording a
            new payment soon.
          </AlertDescription>
        </Alert>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            <Button onClick={() => setIsRecordPaymentOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {student.payments.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No payments recorded yet</p>
              <Button onClick={() => setIsRecordPaymentOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                Record First Payment
              </Button>
            </div>
          ) : (
            <DataTable data={student.payments} columns={paymentColumns} pageSize={10} />
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment for {student.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  className="pl-10"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="classes">Classes Purchased *</Label>
              <Input
                id="classes"
                type="number"
                min="1"
                placeholder="0"
                value={formData.classesPurchased}
                onChange={(e) => setFormData((prev) => ({ ...prev, classesPurchased: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>

            {/* Price per class calculation */}
            {formData.amount && formData.classesPurchased && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Price per class:</span>
                  <span className="font-medium text-slate-900">${calculateClassPrice()}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.paymentDate && "text-muted-foreground",
                    )}
                    disabled={isSubmitting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.paymentDate ? format(formData.paymentDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.paymentDate}
                    onSelect={(date) => {
                      if (date) {
                        setFormData((prev) => ({ ...prev, paymentDate: date }))
                        setIsCalendarOpen(false)
                      }
                    }}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => {
                    const Icon = method.icon
                    return (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center space-x-2">
                          <Icon className="h-4 w-4" />
                          <span>{method.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this payment..."
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleRecordPayment} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
