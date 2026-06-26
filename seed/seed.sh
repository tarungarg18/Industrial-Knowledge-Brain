#!/bin/bash
# Seed script for the Industrial Knowledge Brain pod.
# Run AFTER importing the bundle to populate sample data.
# Usage: bash seed/seed.sh

set -euo pipefail

echo "=== Seeding Industrial Knowledge Brain ==="

# 1. Upload sample files
echo "--- Uploading sample documents ---"
lemma files upload ./seed/sample-manual.pdf /knowledge/manuals/sample-manual.pdf 2>/dev/null || echo "  (sample-manual.pdf not found, skipping)"
lemma files upload ./seed/sample-sop.pdf /knowledge/procedures/sample-sop.pdf 2>/dev/null || echo "  (sample-sop.pdf not found, skipping)"

# 2. Create sample document records
echo "--- Creating sample document records ---"
lemma records create documents --data '{
  "title": "Pump-301 Operation and Maintenance Manual",
  "file_path": "/knowledge/manuals/sample-manual.pdf",
  "doc_type": "manual",
  "status": "uploaded",
  "department": "Maintenance",
  "description": "Comprehensive manual for Model P-301 centrifugal pump"
}'

lemma records create documents --data '{
  "title": "Lockout/Tagout Standard Operating Procedure",
  "file_path": "/knowledge/procedures/sample-sop.pdf",
  "doc_type": "procedure",
  "status": "uploaded",
  "department": "Safety",
  "description": "Plant-wide LOTO procedure for equipment maintenance"
}'

# 3. Create sample equipment catalog entries
echo "--- Creating sample equipment ---"
lemma records create equipment --data '{
  "name": "Centrifugal Pump P-301",
  "equipment_code": "PUMP-301",
  "category": "mechanical",
  "description": "Main process water centrifugal pump, 50 HP",
  "manufacturer": "FlowCorp",
  "model": "FC-4500",
  "location": "Building A, Level 2",
  "status": "active",
  "specifications": {"flow_rate": "500 GPM", "head": "150 ft", "motor_power": "50 HP", "speed": "1750 RPM"}
}'

lemma records create equipment --data '{
  "name": "Air Compressor AC-101",
  "equipment_code": "COMP-101",
  "category": "mechanical",
  "description": "Plant main compressed air supply",
  "manufacturer": "AirTech",
  "model": "AT-2000",
  "location": "Utility Building",
  "status": "active",
  "specifications": {"pressure": "125 PSI", "capacity": "500 CFM", "motor_power": "100 HP"}
}'

# 4. Create sample seed data for the documents table trigger
echo "=== Seed complete ==="
echo ""
echo "Documents uploaded and records created."
echo "The document-auto-ingest schedule will trigger document-ingestion workflows."
echo ""
echo "To verify:"
echo "  lemma records list documents --limit 5"
echo "  lemma records list equipment --limit 5"
