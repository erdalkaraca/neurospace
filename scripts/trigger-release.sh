#!/bin/bash
set -e

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

DRY_RUN=false
VERSION_PART="patch"

for arg in "$@"; do
    case $arg in
        --dry-run|-n)
            DRY_RUN=true
            ;;
        major|minor|patch)
            VERSION_PART="$arg"
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Usage: $0 [--dry-run|-n] [major|minor|patch]"
            exit 1
            ;;
    esac
done

if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN MODE - No changes will be pushed"
    echo ""
fi

echo "Incrementing $VERSION_PART version"

echo "Fetching latest tags..."
git fetch --tags

LATEST_TAG=$(git tag --sort=-v:refname | head -1)

if [ -z "$LATEST_TAG" ]; then
    echo "No tags found. Starting with version 0.1.0"
    NEXT_VERSION="0.1.0"
else
    echo "Latest tag: $LATEST_TAG"

    if [[ $LATEST_TAG =~ ^v?([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
        MAJOR="${BASH_REMATCH[1]}"
        MINOR="${BASH_REMATCH[2]}"
        PATCH="${BASH_REMATCH[3]}"

        case $VERSION_PART in
            major)
                MAJOR=$((MAJOR + 1))
                MINOR=0
                PATCH=0
                ;;
            minor)
                MINOR=$((MINOR + 1))
                PATCH=0
                ;;
            patch)
                PATCH=$((PATCH + 1))
                ;;
        esac
        NEXT_VERSION="$MAJOR.$MINOR.$PATCH"
    else
        echo "Error: Could not parse version from tag: $LATEST_TAG"
        exit 1
    fi
fi

echo "Next version: $NEXT_VERSION"

CHANGES=$(git log $LATEST_TAG..HEAD --oneline --no-decorate --stat 2>/dev/null || true)

echo ""
echo "Changes since $LATEST_TAG:"
echo "---"
echo "$CHANGES"
echo "---"
echo ""

SUMMARY=""
if [ -n "$OPENAI_API_KEY" ] && [ -n "$CHANGES" ]; then
    echo "Generating AI summary of changes..."

    CHANGES_ESCAPED=$(echo "$CHANGES" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
    PROMPT="Summarize the following git commits at an abstract level for end users. Focus on features, fixes, and improvements without technical implementation details. Keep it concise:\\n\\n$CHANGES_ESCAPED"

    API_RESPONSE=$(curl -s https://api.openai.com/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -d "{\"model\":\"gpt-4o-mini\",\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}],\"temperature\":0.7,\"max_tokens\":500}")

    if command -v python3 &> /dev/null; then
        SUMMARY=$(echo "$API_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['choices'][0]['message']['content'] if 'choices' in data else '')" 2>/dev/null)
    else
        SUMMARY=$(echo "$API_RESPONSE" | grep -o '"content"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"content"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')
    fi

    if [ -n "$SUMMARY" ]; then
        echo ""
        echo "AI Summary:"
        echo "---"
        echo "$SUMMARY"
        echo "---"
        echo ""
    fi
fi

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "📝 Would create commit with message:"
    echo "---"
    echo "Subject: Release: v$NEXT_VERSION"
    echo ""
    echo "Body:"
    if [ -z "$CHANGES" ]; then
        echo "No changes since last release."
    elif [ -n "$SUMMARY" ]; then
        echo "$SUMMARY"
    else
        echo "Changes since $LATEST_TAG:"
        echo "$CHANGES"
    fi
    echo "---"
    echo ""
    echo "🚫 DRY RUN: No commit created, nothing pushed"
else
    echo "Creating empty commit..."
    if [ -z "$CHANGES" ]; then
        git commit --allow-empty -m "Release: v$NEXT_VERSION" -m "No changes since last release."
    elif [ -n "$SUMMARY" ]; then
        git commit --allow-empty -m "Release: v$NEXT_VERSION" -m "$SUMMARY"
    else
        git commit --allow-empty -m "Release: v$NEXT_VERSION" -m "Changes since $LATEST_TAG:" -m "$CHANGES"
    fi

    echo "Pushing to remote..."
    git push

    echo "✓ Release v$NEXT_VERSION triggered successfully!"
fi
