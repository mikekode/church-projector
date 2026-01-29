import re

target_file = r"c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector\app\dashboard\page.tsx"

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix "text - [10px]" -> "text-[10px]"
# Pattern: "text - [" -> "text-["

new_content = re.sub(r'text\s+-\s+\[', 'text-[', content)

# Check for other arbitrary bracket styles if any
# e.g. "w - [70vw]" -> "w-[70vw]"
# Regex:  ([a-z0-9]+)\s+-\s+\[
new_content = re.sub(r'([a-z0-9]+)\s+-\s+\[', r'\1-[', new_content)

print("Fixed bracket styles. Length:", len(new_content))

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(new_content)
