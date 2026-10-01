#!/usr/bin/env bash
# C12: dependency footprint of three configurations, installed in a scratch directory
# outside the repository (SPIKE_SCRATCH, default $TMPDIR/docsmart-template-spike) with install scripts disabled. Nothing is installed in the repository.
# Run: bash src/validation/c12-footprint.sh
set -u
S="${SPIKE_SCRATCH:-${TMPDIR:-/tmp}/docsmart-template-spike}/c12"
SPIKE=$(cd "$(dirname "$0")/../.." && pwd)
mkdir -p "$S"/{a,b,b2,c}
echo '{"name":"a","version":"0.0.0","private":true,"dependencies":{"@accordproject/markdown-template":"^1.1.0","@accordproject/concerto-core":"^5.0.0"}}' > "$S/a/package.json"
echo '{"name":"b","version":"0.0.0","private":true,"dependencies":{"@accordproject/markdown-template":"^1.1.0","@accordproject/concerto-core":"^5.0.0","@accordproject/template-engine":"^5.1.0"}}' > "$S/b/package.json"
cp "$S/b/package.json" "$S/b2/package.json"
cp "$SPIKE/package.json" "$S/c/package.json"
for d in a b b2 c; do
  extra=""; [ "$d" = b2 ] && extra="--omit=optional"
  (cd "$S/$d" && rm -rf node_modules package-lock.json && npm install --ignore-scripts --no-audit --no-fund $extra > install.log 2>&1)
  cd "$S/$d"
  label=$d; case $d in a) label="a: markdown-template + concerto-core";; b) label="b: a + template-engine";; b2) label="b2: b with --omit=optional";; c) label="c: the spike as declared";; esac
  echo "== $label :: $(tail -1 install.log) :: $(du -sm node_modules | cut -f1) MB on disk"
  for p in typescript @typescript/twoslash @accordproject/cicero-core @google/genai @openrouter/sdk openai @anthropic-ai/sdk @mistralai/mistralai groq-sdk; do
    [ -f "node_modules/$p/package.json" ] && echo "   present: $p $(node -p "require('./node_modules/$p/package.json').version")"
  done
  node -e "const l=require('./package-lock.json');const s=Object.entries(l.packages).filter(([k,v])=>v.hasInstallScript&&k).map(([k])=>k.replace('node_modules/',''));console.log('   packages with install scripts (not run):',s.join(', ')||'none')"
done
cd "$S/c" && echo "== who pulls the AI SDKs and TypeScript (config c)" && npm ls @google/genai @openrouter/sdk openai @anthropic-ai/sdk @mistralai/mistralai groq-sdk typescript @accordproject/cicero-core
echo "== the spike's own install: $(node -e "console.log(Object.keys(require('$SPIKE/node_modules/.package-lock.json').packages).length)") packages in $SPIKE/node_modules/.package-lock.json"
