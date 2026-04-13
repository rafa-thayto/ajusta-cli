#!/usr/bin/env bash
set -euo pipefail

# ── Release script for ajusta CLI ────────────────────────────────────
# Usage:
#   ./scripts/release.sh          # minor bump (1.8.x → 1.9.0)
#   ./scripts/release.sh patch    # patch bump (1.8.2 → 1.8.3)
#   ./scripts/release.sh minor    # minor bump (1.8.x → 1.9.0)
#   ./scripts/release.sh major    # major bump (1.x.x → 2.0.0)

BUMP="${1:-minor}"

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "❌ Uso: ./scripts/release.sh [patch|minor|major]"
  exit 1
fi

# Ensure working directory is clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Working directory não está limpo. Commit ou stash suas alterações."
  exit 1
fi

# Ensure we're on main
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
  echo "❌ Você precisa estar na branch main (atual: $BRANCH)"
  exit 1
fi

# Get current version before bump
OLD_VERSION=$(node -p "require('./package.json').version")

# Bump version
npm version "$BUMP" --no-git-tag-version > /dev/null
NEW_VERSION=$(node -p "require('./package.json').version")

echo "📦 $OLD_VERSION → $NEW_VERSION ($BUMP)"

# Build
echo "🔨 Building..."
npm run build > /dev/null 2>&1

# Generate changelog from commits since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -n "$LAST_TAG" ]]; then
  CHANGELOG=$(git log "$LAST_TAG"..HEAD --pretty=format:"- %s" --no-merges | grep -v "^- v\?[0-9]" || true)
else
  CHANGELOG=$(git log --pretty=format:"- %s" --no-merges | grep -v "^- v\?[0-9]" || true)
fi

if [[ -z "$CHANGELOG" ]]; then
  CHANGELOG="- Release $NEW_VERSION"
fi

echo ""
echo "📝 Changelog:"
echo "$CHANGELOG"
echo ""

# Commit, tag, publish
git add package.json
git commit -m "$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "v$NEW_VERSION"

echo "🚀 Publishing to npm..."
npm publish

echo "📤 Pushing to GitHub..."
git push origin main --tags

# Create GitHub release with changelog
echo "📋 Creating GitHub release..."
gh release create "v$NEW_VERSION" \
  --title "v$NEW_VERSION" \
  --notes "$CHANGELOG"

echo ""
echo "✅ ajusta@$NEW_VERSION released!"
echo "   npm: https://www.npmjs.com/package/ajusta/v/$NEW_VERSION"
echo "   gh:  https://github.com/rafa-thayto/ajusta-cli/releases/tag/v$NEW_VERSION"
