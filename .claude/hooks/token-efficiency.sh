#!/bin/sh
# Injects the token-efficiency core contract into every prompt.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"TOKEN EFFICIENCY (user requirement, every turn): answer first, no preamble/recap/filler; short replies sized to the question; batch independent tool calls; never re-read a file just edited; filter command output (head/grep); read file ranges not whole files; no duplicate searches or repeat verification of passing checks. Never cut: correctness, needed caveats, actually running tests/builds."}}
JSON
