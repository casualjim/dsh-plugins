#!/bin/bash
# Regenerate lib-variant unit tests (.test.ts) from src variants (.src.test.ts).
# Only import specifiers change: ../src/*.ts -> ../lib/*.js
set -e
cd "$(dirname "$0")/../test"
for f in *.src.test.ts; do
  base="${f%%.src.test.ts}.test.ts"
  sed 's|\.\./src/\([a-zA-Z0-9/_-]*\)\.ts|../lib/\1.js|g' "$f" > "$base"
done
echo "regenerated: $(ls *.test.ts | wc -l | tr -d ' ') files"
