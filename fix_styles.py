import re

target_file = r"c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector\app\dashboard\page.tsx"

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix spaces around hyphens in class names
# Pattern: Word followed by " - " followed by Word/Number
# applied globally might be risky?
# But in this file, " - " is likely only in the corrupted class names or comments.
# Comments like "Resource Library (Bottom)" also use parens.
# "items - center" -> "items-center"

def fixer(match):
    return match.group(1) + "-" + match.group(2)

# Repeating the fix until stable (in case of double spaces?)
# Regex: ([a-z0-9]+)\s+-\s+([a-z0-9%]+)
# This matches "items - center", "rounded - 2xl", "w - 1.5"
new_content = re.sub(r'([a-z0-9]+)\s+-\s+([a-z0-9%.]+)', fixer, content)

# Also fix "flex - 1" -> "flex-1"
# "min - h - 0" -> "min-h-0"
# Run 3 times to handle multiple hyphens
for _ in range(3):
    new_content = re.sub(r'([a-z0-9]+)\s+-\s+([a-z0-9%.]+)', fixer, new_content)

print("Fixed content length:", len(new_content))

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(new_content)
