#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/employee-mobile"
if [[ ! -d android || ! -d ios ]]; then
  flutter create --platforms=android,ios --org com.shiftly.hr --project-name shiftly_employee .
fi
flutter pub get
flutter analyze
flutter test
