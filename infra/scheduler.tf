# This file defines the time-based trigger for our background worker.
# It assumes our Next.js application is deployed as a serverless function
# on Alibaba Cloud Function Compute.

variable "function_name" {
  description = "The name of the deployed Function Compute function for our app."
  type        = string
  default     = "yingyu-app-prod"
}

variable "service_name" {
  description = "The name of the Function Compute service."
  type        = string
  default     = "yingyu-service-prod"
}

variable "cron_secret" {
  description = "The secret key to authorize the trigger."
  type        = string
  sensitive   = true
}

# The Time Trigger Resource
resource "alicloud_fc_trigger" "yingyu_worker_trigger" {
  service  = var.service_name
  function = var.function_name
  name     = "yingyu-worker-trigger-every-minute"
  type     = "timer"

  # Meticulous Configuration for the Trigger
  config_mns = jsonencode({
    # CRON Expression: This runs at the start of every minute, of every hour, of every day.
    # This is the standard configuration for a high-frequency worker.
    "cronExpression": "@every 1m",

    # The payload that will be sent to our function.
    # Our function's code doesn't use the payload, but it's required.
    "payload": "{\"trigger\": \"timer\"}",

    # Enable the trigger immediately upon creation.
    "enable": true
  })

  # This is the crucial part. We configure the trigger to make an HTTP POST request
  # to our specific worker endpoint.
  http_config {
    # The path to our secure worker endpoint.
    path = "/api/worker"
    
    # The request method must be POST.
    method = "POST"

    # We pass the CRON_SECRET in the Authorization header, exactly as our
    # worker endpoint expects. This secures the endpoint.
    headers = {
      "Authorization" = "Bearer ${var.cron_secret}"
    }
  }
}

